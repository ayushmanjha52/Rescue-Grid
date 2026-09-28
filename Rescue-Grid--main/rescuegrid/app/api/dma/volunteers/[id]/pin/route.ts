import { NextResponse } from 'next/server';
import { requireDma } from '@/lib/auth/dma';
import { createAdminClient } from '@/lib/supabase/admin';
import { createVolunteerLogin, generateTempPin, setVolunteerPin } from '@/lib/auth/volunteerAccounts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Command gives a volunteer a new temporary PIN (forgotten PIN, or a
 * volunteer who never had a login). Returned once, to hand over in person
 * or by phone.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDma();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });

    const admin = createAdminClient();
    const { data: volunteer } = await admin.from('volunteer').select('id, name, mobile_no, auth_id').eq('id', id).maybeSingle();
    if (!volunteer) return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });

    const pin = generateTempPin();
    if (volunteer.auth_id) {
      await setVolunteerPin(admin, volunteer.auth_id, pin);
    } else {
      const authId = await createVolunteerLogin(admin, volunteer.mobile_no, pin);
      await admin.from('volunteer').update({ auth_id: authId }).eq('id', volunteer.id);
    }

    return NextResponse.json({ name: volunteer.name, mobile_no: volunteer.mobile_no, temp_pin: pin });
  } catch (error) {
    console.error('Error in POST /api/dma/volunteers/[id]/pin:', error);
    return NextResponse.json({ error: 'Could not reset the PIN' }, { status: 500 });
  }
}
