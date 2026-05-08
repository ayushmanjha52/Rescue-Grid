import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export async function getVolunteer() {
  const cookieStore = await cookies();
  const volunteerCookie = cookieStore.get('volunteer_session');

  if (!volunteerCookie) return null;

  try {
    const session = JSON.parse(volunteerCookie.value);
    return session;
  } catch {
    return null;
  }
}

export async function getVolunteerFromDb() {
  const session = await getVolunteer();
  if (!session?.volunteer_id) return null;

  // Use service client to bypass RLS — volunteer app uses cookie-based auth,
  // not Supabase Auth, so auth.uid() is null and RLS blocks anon reads.
  const supabase = createServiceClient();

  const { data: volunteer, error } = await supabase
    .from('volunteer')
    .select('*')
    .eq('id', session.volunteer_id)
    .single();

  if (error) {
    console.error('getVolunteerFromDb error:', error);
    return null;
  }

  return volunteer;
}
