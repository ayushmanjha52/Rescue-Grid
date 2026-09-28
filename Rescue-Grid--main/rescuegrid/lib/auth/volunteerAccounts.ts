import { randomInt } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';
import { VOLUNTEER_ROLE, volunteerLoginEmail } from '@/lib/auth/volunteerAccess';

type AdminClient = ReturnType<typeof createAdminClient>;

export const MIN_PIN_LENGTH = 6;
export const MAX_PIN_LENGTH = 72;

export function validatePin(pin: unknown): string | null {
  if (typeof pin !== 'string') return null;
  return pin.length >= MIN_PIN_LENGTH && pin.length <= MAX_PIN_LENGTH ? pin : null;
}

/** Six random digits, for PINs that Command hands to walk-ins or after a reset. */
export function generateTempPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Creates the Supabase login for a volunteer (no SMS or email is sent). Returns the auth user id. */
export async function createVolunteerLogin(admin: AdminClient, normalizedPhone: string, pin: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: volunteerLoginEmail(normalizedPhone),
    password: pin,
    email_confirm: true,
    app_metadata: { role: VOLUNTEER_ROLE },
    user_metadata: { phone: normalizedPhone },
  });
  if (error || !data.user) throw error ?? new Error('Could not create login');
  return data.user.id;
}

/** Sets a new PIN on an existing volunteer login. */
export async function setVolunteerPin(admin: AdminClient, authId: string, pin: string) {
  const { error } = await admin.auth.admin.updateUserById(authId, { password: pin });
  if (error) throw error;
}
