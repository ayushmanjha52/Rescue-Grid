import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireVolunteer } from '@/lib/auth/getVolunteer';

export async function POST(request: Request) {
  try {
    const auth = await requireVolunteer();
    if (auth.response) return auth.response;
    const { volunteerId } = auth;

    const body = await request.json().catch(() => ({}));
    // Accept the PushSubscription object (preferred) or a pre-serialized string.
    let subscription = body.subscription ?? body.push_token;
    if (typeof subscription === 'string') {
      try {
        subscription = JSON.parse(subscription);
      } catch {
        subscription = null;
      }
    }

    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys) {
      return NextResponse.json({ error: 'A valid push subscription is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('volunteer')
      .update({ push_token: JSON.stringify(subscription) })
      .eq('id', volunteerId);

    if (error) {
      console.error('Error saving push token:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/volunteer/push-token:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await requireVolunteer();
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  await supabase.from('volunteer').update({ push_token: null }).eq('id', auth.volunteerId);
  return NextResponse.json({ success: true });
}
