import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ listings: [], creators: [] });
  }

  const supabase = await createClient();
  // Sanitize search input to prevent PostgREST filter injection
  // Commas, parens, and backslashes have special meaning in .or() filter syntax
  const sanitized = q.replace(/[,()\\]/g, ' ').trim();
  if (!sanitized) {
    return NextResponse.json({ listings: [], creators: [] });
  }
  const pattern = `%${sanitized}%`;

  const [listingsRes, creatorsRes] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, category, price, user_id, profiles(full_name)')
      .eq('is_active', true)
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

  return NextResponse.json({
    listings: listingsRes.data ?? [],
    creators: creatorsRes.data ?? [],
  });
}
