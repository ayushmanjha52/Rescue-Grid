import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LEGACY_VOLUNTEER_COOKIE } from '@/lib/auth/volunteerAccess';

export async function POST() {
  // Revokes the refresh token and clears the Supabase session cookies.
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  response.cookies.delete(LEGACY_VOLUNTEER_COOKIE);
  return response;
}
