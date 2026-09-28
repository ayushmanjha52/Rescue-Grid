import VolunteerLoginForm from '@/components/volunteer/VolunteerLoginForm';

// Server component: reads ?join=1 on the server so the form is in the first
// HTML response (fast on weak networks, visible to search engines).
export default async function VolunteerLoginPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  return <VolunteerLoginForm initialMode={join === '1' ? 'join' : 'signin'} />;
}
