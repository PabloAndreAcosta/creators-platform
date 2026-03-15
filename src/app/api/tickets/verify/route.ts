import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const id = req.nextUrl.searchParams.get('id');

  if (!code || !id) {
    return NextResponse.json({ valid: false, error: 'Saknar kod eller id' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, scheduled_at, listings(title, event_date, event_time, event_location)')
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ valid: false, error: 'Biljett hittades inte' }, { status: 404 });
  }

  // Verify code matches
  const expectedCode = `USH-${booking.id.slice(0, 8).toUpperCase()}`;
  if (code !== expectedCode) {
    return NextResponse.json({ valid: false, error: 'Ogiltig biljettkod' }, { status: 400 });
  }

  const isValid = booking.status === 'confirmed' || booking.status === 'pending';
  const listing = booking.listings as unknown as { title: string; event_date?: string | null; event_time?: string | null; event_location?: string | null } | null;

  return NextResponse.json({
    valid: isValid,
    status: booking.status,
    ticket: {
      code: expectedCode,
      title: listing?.title || 'Bokning',
      date: listing?.event_date || booking.scheduled_at,
      time: listing?.event_time || null,
      location: listing?.event_location || null,
    },
  });
}
