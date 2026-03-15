import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — fetch user settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Return defaults if no settings exist yet
  return NextResponse.json({
    settings: data ?? {
      notif_booking_new: true,
      notif_booking_confirmed: true,
      notif_booking_canceled: true,
      notif_payout: true,
      notif_marketing: false,
      privacy_public_profile: true,
      privacy_show_location: true,
      privacy_show_reviews: true,
      privacy_booking_history: false,
    },
  });
}

// PUT — update user settings
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Only allow known fields
  const allowed = [
    'notif_booking_new', 'notif_booking_confirmed', 'notif_booking_canceled',
    'notif_payout', 'notif_marketing',
    'privacy_public_profile', 'privacy_show_location', 'privacy_show_reviews',
    'privacy_booking_history',
  ];

  const updates: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Inga giltiga fält' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) {
    return NextResponse.json({ error: 'Kunde inte spara inställningar' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
