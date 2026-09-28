import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizePhone } from '@/lib/phone';
import { clientIp, enforceRateLimits } from '@/lib/rateLimit';
import { isVolunteerAuthUser, LEGACY_VOLUNTEER_COOKIE, volunteerLoginEmail } from '@/lib/auth/volunteerAccess';

const WRONG = 'Wrong mobile number or PIN.';

/** Volunteer sign-in with phone number + PIN (no SMS). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!phone || !pin) {
    return NextResponse.json({ error: 'Enter your mobile number and PIN' }, { status: 400 });
  }

  // Stops PIN guessing.
  const limited = await enforceRateLimits(
    [
      { key: `volunteer-login:phone:${phone}`, limit: 10, windowSeconds: 900 },
      { key: `volunteer-login:ip:${clientIp(request)}`, limit: 40, windowSeconds: 900 },
    ],
    'Too many attempts. Please wait 15 minutes, or ask the command team to reset your PIN.'
  );
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: volunteerLoginEmail(phone), password: pin });
    if (error || !data.user) {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const { data: volunteer } = await createServiceClient()
      .from('volunteer')
      .select('id, name')
      .eq('auth_id', data.user.id)
      .maybeSingle();

    if (!isVolunteerAuthUser(data.user) || !volunteer) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, volunteer_id: volunteer.id, name: volunteer.name });
    response.cookies.delete(LEGACY_VOLUNTEER_COOKIE);
    return response;
  } catch (error) {
    console.error('Error in POST /api/volunteer/auth/login:', error);
    return NextResponse.json({ error: 'Could not sign you in. Please try again.' }, { status: 500 });
  }
}
