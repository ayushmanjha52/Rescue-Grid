import type { User } from '@supabase/supabase-js';

/** Value of `app_metadata.role` that marks a DMA operator. */
export const DMA_OPERATOR_ROLE = 'dma_operator';

/**
 * A DMA operator is a Supabase Auth user whose `app_metadata.role` is
 * "dma_operator". Only the service key can set app_metadata (see
 * `bun run db:operator`), so signing up with an email is not enough. That
 * matters because sign-ups must stay open for volunteers' phone logins.
 * The database's is_dma_operator() applies the same rule to Row Level Security.
 *
 * DMA_ALLOWED_EMAILS (comma separated) optionally narrows access further.
 */
export function isDmaUser(user: Pick<User, 'email' | 'app_metadata'> | null | undefined): boolean {
  if (!user?.email) return false;
  if (user.app_metadata?.role !== DMA_OPERATOR_ROLE) return false;
  const allowList = (process.env.DMA_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowList.length === 0) return true;
  return allowList.includes(user.email.toLowerCase());
}
