import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';

function isValidCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const supabase = createServiceClient();
    const { latitude, longitude, accuracy } = await request.json().catch(() => ({}));

    if (!isValidCoordinate(latitude, 90) || !isValidCoordinate(longitude, 180)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const updateData: Record<string, number | string> = {
      latitude,
      longitude,
      last_seen: new Date().toISOString(),
    };

    if (typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0) {
      updateData.accuracy = accuracy;
    }

    const { error } = await supabase
      .from('volunteer')
      .update(updateData)
      .eq('id', volunteerId);

    if (error) {
      console.error('Error updating location:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/location:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
