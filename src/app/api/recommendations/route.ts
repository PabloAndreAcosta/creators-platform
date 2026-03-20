import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecommendations } from '@/lib/recommendations/engine';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    let user;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      return NextResponse.json({ recommendations: [] });
    }

    if (!user) {
      return NextResponse.json({ recommendations: [] });
    }

    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId') || user.id;
    const limit = Math.min(Number(searchParams.get('limit') || 5), 20);

    const results = await getRecommendations(userId, limit);

    const recommendations = results.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price ?? 0,
      category: r.category,
      event_date: r.event_date ?? null,
      event_location: r.event_location ?? null,
      image_url: r.image_url ?? null,
      creator_id: r.creator.id,
      profiles: { full_name: r.creator.full_name ?? null },
      eventTier: r.event_tier ?? "",
      bookingCount: r.bookingCount ?? 0,
      creator: {
        id: r.creator.id,
        name: r.creator.full_name,
        avatar: r.creator.avatar_url,
      },
    }));

    return NextResponse.json(
      { recommendations },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta rekommendationer' },
      { status: 500 }
    );
  }
}
