import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const supabaseAdmin = createAdminClient();

  const { phone, token } = await request.json();

  if (!phone || !token) {
    return NextResponse.json({ error: 'Phone and token required' }, { status: 400 });
  }

  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  try {
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: token,
      type: 'sms',
    });

    if (otpError) {
      console.error('OTP verify error:', otpError);
      return NextResponse.json({ error: otpError.message }, { status: 400 });
    }

    if (!otpData.user) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const authId = otpData.user.id;

    const { data: existingVolunteer, error: lookupError } = await supabaseAdmin
      .from('volunteer')
      .select('id, name, mobile_no, auth_id')
      .eq('mobile_no', normalizedPhone)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      console.error('Volunteer lookup error:', lookupError);
    }

    let volunteerId: string;

    if (existingVolunteer) {
      if (!existingVolunteer.auth_id) {
        await supabaseAdmin
          .from('volunteer')
          .update({ auth_id: authId })
          .eq('id', existingVolunteer.id);
      }
      volunteerId = existingVolunteer.id;
    } else {
      const { data: newVolunteer, error: createError } = await supabaseAdmin
        .from('volunteer')
        .insert({
          name: `Volunteer ${normalizedPhone.slice(-4)}`,
          mobile_no: normalizedPhone,
          auth_id: authId,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Create volunteer error:', createError);
        return NextResponse.json({ error: 'Failed to create volunteer record' }, { status: 500 });
      }
      volunteerId = newVolunteer.id;
    }

    const response = NextResponse.json({
      success: true,
      volunteer_id: volunteerId,
      name: existingVolunteer?.name || `Volunteer ${normalizedPhone.slice(-4)}`,
    });

    response.cookies.set(
      'volunteer_session',
      JSON.stringify({
        volunteer_id: volunteerId,
        phone: normalizedPhone,
        auth_uid: authId,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      }
    );

    return response;
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
