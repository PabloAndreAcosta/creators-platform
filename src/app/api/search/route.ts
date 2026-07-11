import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Throttle the public search (per IP) — it's unauthenticated and hits the DB.
    const { rateLimit, getRateLimitKey } = await import('@/lib/rate-limit');
    if (!rateLimit(getRateLimitKey(req, 'search'), 30, 60_000).allowed) {
      return NextResponse.json({ listings: [], creators: [] }, { status: 429 });
    }

    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ listings: [], creators: [] });
    }

    const supabase = await createClient();
    // Sanitize search input: strip PostgREST .or() metacharacters (, ( ) \) AND
    // ilike wildcards (% * _) so a query can't become a match-all, and cap length.
    const sanitized = q.slice(0, 100).replace(/[,()\\%*_]/g, ' ').trim();
    if (!sanitized) {
      return NextResponse.json({ listings: [], creators: [] });
    }
    const pattern = `%${sanitized}%`;

    const [listingsRes, creatorsRes] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, category, price, user_id, profiles(full_name)')
        .eq('is_active', true)
        .eq('is_public', true)
        .or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},event_location.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('profiles')
        .select('id, full_name, category, location, avatar_url')
        .eq('is_public', true)
        .or(`full_name.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern},bio.ilike.${pattern}`)
        .limit(8),
    ]);

    // Surface query errors instead of silently returning [] — a broken embed
    // (missing FK relationship) previously hid all event results with no trace.
    if (listingsRes.error) console.error("search: listings query failed", listingsRes.error);
    if (creatorsRes.error) console.error("search: creators query failed", creatorsRes.error);

    return NextResponse.json({
      listings: listingsRes.data ?? [],
      creators: creatorsRes.data ?? [],
    });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
