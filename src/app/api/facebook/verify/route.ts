import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET — Verify that the stored Facebook page token is still valid.
 * Returns { verified: true, pageName, followers } or { verified: false, error }.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ verified: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('facebook_page_id, facebook_page_name, facebook_page_access_token')
    .eq('id', user.id)
    .single();

  if (!profile?.facebook_page_id || !profile?.facebook_page_access_token) {
    return NextResponse.json({ verified: false, error: 'Ingen Facebook-sida ansluten' });
  }

  try {
    // Test the token by fetching page info
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${profile.facebook_page_id}?` +
        new URLSearchParams({
          fields: 'id,name,followers_count,fan_count',
          access_token: profile.facebook_page_access_token,
        })
    );

    if (!res.ok) {
      const err = await res.json();
      const expired = err.error?.code === 190;
      return NextResponse.json({
        verified: false,
        error: expired
          ? 'Facebook-token har gått ut. Anslut igen.'
          : 'Kunde inte verifiera Facebook-sidan.',
        expired,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      verified: true,
      pageName: data.name || profile.facebook_page_name,
      pageId: data.id,
      followers: data.followers_count ?? data.fan_count ?? null,
    });
  } catch {
    return NextResponse.json({
      verified: false,
      error: 'Nätverksfel vid verifiering',
    });
  }
}
