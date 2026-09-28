import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/phone';
import { clientIp, enforceRateLimits } from '@/lib/rateLimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { LEGACY_VOLUNTEER_COOKIE, volunteerLoginEmail } from '@/lib/auth/volunteerAccess';
import { createVolunteerLogin, MIN_PIN_LENGTH, validatePin } from '@/lib/auth/volunteerAccounts';
import { validateVolunteerName } from '@/lib/volunteers';

/** Join as a volunteer: phone number + PIN, no SMS (free). Signs the new volunteer in. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = validateVolunteerName(body.name);
  const phone = normalizePhone(body.phone);
  const pin = validatePin(body.pin);

  if (!name) return NextResponse.json({ error: 'Please enter your name (2–80 characters)' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'Enter a valid mobile number' }, { status: 400 });
  if (!pin) return NextResponse.json({ error: `Choose a PIN of at least ${MIN_PIN_LENGTH} characters` }, { status: 400 });
  if (body.agreed !== true) {
    return NextResponse.json({ error: 'Please confirm you are 18 or older and agree to share your details' }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!(await verifyTurnstile(body.captcha_token, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.' }, { status: 400 });
  }
  const limited = await enforceRateLimits(
    [
      { key: `volunteer-signup:ip:${ip}`, limit: 10, windowSeconds: 3600 },
      { key: `volunteer-signup:phone:${phone}`, limit: 3, windowSeconds: 3600 },
    ],
    'Too many sign-up attempts. Please wait a while and try again.'
  );
  if (limited) return limited;

  const admin = createAdminClient();

  try {
    // A number can only be registered once. Walk-ins registered by Command get
    // their PIN from Command instead of claiming the record here.
    const { data: existing } = await admin.from('volunteer').select('id').eq('mobile_no', phone).maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'This number is already registered. Sign in instead, or ask the command team to reset your PIN.' },
        { status: 409 }
      );
    }

    let authId: string;
    try {
      authId = await createVolunteerLogin(admin, phone, pin);
    } catch (error) {
      console.error('Volunteer login creation failed:', error);
      const message = error instanceof Error && /already/i.test(error.message)
        ? 'This number is already registered. Sign in instead.'
        : 'Could not create your account. Please try again.';
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const { data: volunteer, error: insertError } = await admin
      .from('volunteer')
      .insert({ name, mobile_no: phone, auth_id: authId, status: 'active', type: 'Individual' })
      .select('id')
      .single();

    if (insertError || !volunteer) {
      console.error('Volunteer insert failed:', insertError);
      await admin.auth.admin.deleteUser(authId);
      return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 });
    }

    // Sign them straight in (session cookies).
    const supabase = await createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: volunteerLoginEmail(phone), password: pin });
    if (loginError) console.error('Sign-in after sign-up failed:', loginError);

    const response = NextResponse.json({ success: true, volunteer_id: volunteer.id, is_new: true }, { status: 201 });
    response.cookies.delete(LEGACY_VOLUNTEER_COOKIE);
    return response;
  } catch (error) {
    console.error('Error in POST /api/volunteer/auth/signup:', error);
    return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 });
  }
}
