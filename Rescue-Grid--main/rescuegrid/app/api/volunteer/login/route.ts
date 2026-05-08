import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  const { phone } = await request.json();

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  const { data: volunteer, error: volunteerError } = await supabaseAdmin
    .from('volunteer')
    .select('id, mobile_no, name')
    .eq('mobile_no', normalizedPhone)
    .single();

  if (volunteerError || !volunteer) {
    return NextResponse.json({ error: 'Volunteer not found. Check your phone number.' }, { status: 404 });
  }

  const response = NextResponse.json({ 
    success: true, 
    volunteer_id: volunteer.id,
    name: volunteer.name 
  });

  response.cookies.set(
    'volunteer_session',
    JSON.stringify({ 
      volunteer_id: volunteer.id, 
      phone: volunteer.mobile_no,
      name: volunteer.name 
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
}
