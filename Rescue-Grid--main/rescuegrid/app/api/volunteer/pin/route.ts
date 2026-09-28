import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireVolunteer } from '@/lib/auth/getVolunteer';
import { createAdminClient } from '@/lib/supabase/admin';
import { volunteerLoginEmail } from '@/lib/auth/volunteerAccess';
import { MIN_PIN_LENGTH, setVolunteerPin, validatePin } from '@/lib/auth/volunteerAccounts';
import { clientIp, enforceRateLimits } from '@/lib/rateLimit';
import { normalizePhone } from '@/lib/phone';

/** A volunteer changes their own PIN (checks the current one first). */
export async function PATCH(request: NextRequest) {
  const auth = await requireVolunteer();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const current = typeof body.current_pin === 'string' ? body.current_pin : '';
  const next = validatePin(body.new_pin);
  if (!current) return NextResponse.json({ error: 'Enter your current PIN' }, { status: 400 });
  if (!next) return NextResponse.json({ error: `The new PIN needs at least ${MIN_PIN_LENGTH} characters` }, { status: 400 });

  const limited = await enforceRateLimits([
    { key: `volunteer-pin:${auth.volunteerId}`, limit: 10, windowSeconds: 900 },
    { key: `volunteer-pin:ip:${clientIp(request)}`, limit: 30, windowSeconds: 900 },
  ]);
  if (limited) return limited;

  const phone = normalizePhone(auth.phone);
  const loginEmail = auth.user.email || (phone ? volunteerLoginEmail(phone) : null);
  if (!loginEmail) return NextResponse.json({ error: 'Ask the command team to reset your PIN' }, { status: 400 });

  try {
    // Check the current PIN without touching the browser's session.
    const checker = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: wrong } = await checker.auth.signInWithPassword({ email: loginEmail, password: current });
    if (wrong) return NextResponse.json({ error: 'Your current PIN is wrong' }, { status: 401 });
    await checker.auth.signOut();

    await setVolunteerPin(createAdminClient(), auth.user.id, next);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/volunteer/pin:', error);
    return NextResponse.json({ error: 'Could not change your PIN' }, { status: 500 });
  }
}
