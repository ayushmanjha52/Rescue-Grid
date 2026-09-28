import type { createServiceClient } from '@/lib/supabase/service';
import { ALLOCATION_ACTIVE, ALLOCATION_TERMINAL, type AllocationStatus } from '@/lib/status';

type ServiceClient = ReturnType<typeof createServiceClient>;

export class AllocationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface AllocationUpdate {
  status: AllocationStatus;
  quantity_consumed?: number;
  quantity_returned?: number;
  notes?: string | null;
}

function toQuantity(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AllocationError('Quantities must be non-negative numbers', 400);
  return n;
}

/**
 * Atomically changes a resource's stock. Uses the adjust_resource_quantity RPC
 * (migration 015) and falls back to read-modify-write if it isn't installed yet.
 */
export async function adjustResourceQuantity(supabase: ServiceClient, resourceId: string, delta: number) {
  if (delta === 0) return;

  const { error } = await supabase.rpc('adjust_resource_quantity', {
    p_resource_id: resourceId,
    p_delta: delta,
  });
  if (!error) return;

  const { data: resource } = await supabase
    .from('resource')
    .select('quantity')
    .eq('id', resourceId)
    .single();
  if (!resource) return;

  await supabase
    .from('resource')
    .update({
      quantity: Math.max(0, (resource.quantity || 0) + delta),
      updated_at: new Date().toISOString(),
    })
    .eq('id', resourceId);
}

/**
 * Works out how a terminal allocation status splits the allocated quantity
 * into consumed / returned, and how much stock leaves the inventory for good.
 */
export function computeSettlement(
  allocated: number,
  status: 'consumed' | 'returned' | 'lost',
  quantityConsumed?: unknown,
  quantityReturned?: unknown
) {
  let consumed = toQuantity(quantityConsumed);
  let returned = toQuantity(quantityReturned);

  if (status === 'returned') {
    returned ??= allocated;
    consumed ??= allocated - returned;
  } else if (status === 'consumed') {
    consumed ??= allocated - (returned ?? 0);
    returned ??= allocated - consumed;
  } else {
    // lost: whatever isn't accounted for as used or returned is lost
    consumed ??= 0;
    returned ??= 0;
  }

  if (consumed < 0 || returned < 0 || consumed + returned > allocated + 1e-9) {
    throw new AllocationError('Consumed + returned cannot exceed the allocated quantity', 400);
  }

  // Everything that didn't come back is permanently gone from stock.
  return { consumed, returned, deduction: allocated - returned };
}

/**
 * Moves an allocation through its lifecycle.
 *
 * While an allocation is `allocated`/`in_use` its quantity is *reserved* (it is
 * subtracted from what is available but not from `resource.quantity`). When it
 * reaches a terminal state the stock is settled: whatever wasn't returned
 * (consumed or lost) is permanently deducted from the resource.
 */
export async function updateAllocation(supabase: ServiceClient, allocationId: string, update: AllocationUpdate) {
  const { data: allocation } = await supabase
    .from('resource_allocation')
    .select('id, resource_id, status, quantity_allocated, quantity_consumed, quantity_returned, volunteer_id, task_force_id')
    .eq('id', allocationId)
    .single();

  if (!allocation) throw new AllocationError('Allocation not found', 404);

  if ((ALLOCATION_TERMINAL as readonly string[]).includes(allocation.status)) {
    throw new AllocationError(`Allocation is already ${allocation.status}`, 409);
  }

  const allocated = Number(allocation.quantity_allocated) || 0;
  const updateData: Record<string, unknown> = {
    status: update.status,
    updated_at: new Date().toISOString(),
  };
  if (update.notes !== undefined) updateData.notes = update.notes;

  let deduction = 0;

  if (update.status === 'consumed' || update.status === 'returned' || update.status === 'lost') {
    const settlement = computeSettlement(allocated, update.status, update.quantity_consumed, update.quantity_returned);
    updateData.quantity_consumed = settlement.consumed;
    updateData.quantity_returned = settlement.returned;
    deduction = settlement.deduction;
  } else {
    const consumed = toQuantity(update.quantity_consumed);
    if (consumed !== undefined) {
      if (consumed > allocated) throw new AllocationError('Consumed quantity cannot exceed allocated quantity', 400);
      updateData.quantity_consumed = consumed;
    }
  }

  // Only transition from an active state, so two concurrent settlements
  // can't both deduct stock.
  const { data, error } = await supabase
    .from('resource_allocation')
    .update(updateData)
    .eq('id', allocationId)
    .in('status', ALLOCATION_ACTIVE as unknown as string[])
    .select('*, resource:resource_id(name, unit)')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AllocationError('Allocation was updated by someone else — refresh and try again', 409);

  if (deduction > 0) {
    await adjustResourceQuantity(supabase, allocation.resource_id, -deduction);
  } else {
    await supabase
      .from('resource')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', allocation.resource_id);
  }

  return data;
}

/** Sum of quantities currently reserved by active allocations of a resource. */
export async function getReservedQuantity(supabase: ServiceClient, resourceId: string): Promise<number> {
  const { data } = await supabase
    .from('resource_allocation')
    .select('quantity_allocated')
    .eq('resource_id', resourceId)
    .in('status', ALLOCATION_ACTIVE as unknown as string[]);
  return (data || []).reduce((sum: number, a: { quantity_allocated: number }) => sum + (Number(a.quantity_allocated) || 0), 0);
}
