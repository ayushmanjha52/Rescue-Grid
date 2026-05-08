import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { phone } = await request.json();

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        channel: 'sms',
      },
    });

    if (error) {
      console.error('OTP send error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      phone: normalizedPhone,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
