import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecommendations } from '@/lib/recommendations/engine';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId') || user.id;
    const limit = Math.min(Number(searchParams.get('limit') || 5), 20);

    const results = await getRecommendations(userId, limit);

    const recommendations = results.map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price ?? 0,
      creator: {
        id: r.creator.id,
        name: r.creator.full_name,
        avatar: r.creator.avatar_url,
      },
      category: r.category,
      eventTier: r.event_tier,
      bookingCount: r.bookingCount,
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
