import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDmaUser } from '@/lib/auth/dmaAccess';
import { getAuthUser, type AuthUser } from '@/lib/auth/session';

export { isDmaUser };

/**
 * For route handlers: resolves the logged-in DMA user, or returns a 401/403
 * response to send back as-is.
 */
export async function requireDma(): Promise<
  { user: AuthUser; response?: never } | { user?: never; response: NextResponse }
> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isDmaUser(user)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}
