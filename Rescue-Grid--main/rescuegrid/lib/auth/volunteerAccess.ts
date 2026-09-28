import type { User } from '@supabase/supabase-js';

/** Value of `app_metadata.role` that marks a volunteer login. */
export const VOLUNTEER_ROLE = 'volunteer';

/**
 * Volunteers sign in with their phone number and a PIN/password; no SMS is
 * sent, so it costs nothing. Supabase needs an email-style login name, so
 * the phone number is mapped to an address on the reserved `.invalid`
 * domain, which can never receive mail. Only the server creates these
 * accounts (see lib/auth/volunteerAccounts.ts), and it gives them the
 * server-only `app_metadata.role = "volunteer"`.
 */
const VOLUNTEER_LOGIN_DOMAIN = 'volunteers.rescuegrid.invalid';

/** Login name for a normalized phone number, e.g. +919876543210 → v919876543210@volunteers.rescuegrid.invalid */
export function volunteerLoginEmail(normalizedPhone: string): string {
  return `v${normalizedPhone.replace(/\D/g, '')}@${VOLUNTEER_LOGIN_DOMAIN}`;
}

/**
 * Is this Supabase login a volunteer? Keeping volunteers and DMA operators
 * apart is what stops a volunteer reaching the DMA dashboard (and vice versa).
 * The database's `is_dma_operator()` applies the matching rule to Row Level
 * Security. Phone-only accounts from the earlier SMS sign-in still count.
 */
export function isVolunteerAuthUser(user: Pick<User, 'email' | 'app_metadata'> | null | undefined): boolean {
  if (!user) return false;
  if (user.app_metadata?.role === VOLUNTEER_ROLE) return true;
  return !user.email;
}

/** Name of the signed cookie used before volunteers moved to Supabase Auth sessions. */
export const LEGACY_VOLUNTEER_COOKIE = 'volunteer_session';
