import type { SupabaseClient, User } from '@supabase/supabase-js';

/** The parts of a signed-in user the app needs, taken from the verified JWT. */
export interface AuthUser {
  id: string;
  email?: string;
  app_metadata: User['app_metadata'];
}

/**
 * Returns the signed-in user, or null.
 *
 * Uses getClaims(), which checks the session JWT's signature locally against
 * the project's public signing key (fetched once and cached) instead of asking
 * Supabase Auth on every request like getUser() does. The database is far from
 * most users (Tokyo), so this saves a full round trip per request. Expired
 * sessions are still refreshed through the cookies.
 *
 * Trade-off: a revoked session stays valid until its JWT expires (at most an
 * hour). Anything sensitive also re-checks the database (e.g. the volunteer
 * row must still exist).
 */
export async function getAuthUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' && claims.email ? claims.email : undefined,
    app_metadata: (claims.app_metadata ?? {}) as User['app_metadata'],
  };
}
