import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — return user's favorite listing IDs
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ favorites: [] });
  }

  const { data } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);

  const favorites = (data ?? []).map((f) => f.listing_id);
  return NextResponse.json({ favorites });
}

// POST — toggle favorite
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { listingId } = await req.json();
  if (!listingId) {
    return NextResponse.json({ error: 'listingId krävs' }, { status: 400 });
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .single();

  if (existing) {
    // Remove favorite
    await supabase
      .from('favorites')
      .delete()
      .eq('id', existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    // Add favorite
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, listing_id: listingId });
    if (error) {
      return NextResponse.json({ error: 'Kunde inte spara favorit' }, { status: 500 });
    }
    return NextResponse.json({ favorited: true });
  }
}
