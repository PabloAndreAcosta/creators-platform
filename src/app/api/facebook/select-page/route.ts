import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { pageId, pageName, pageToken } = await req.json();

  if (!pageId || !pageName || !pageToken) {
    return NextResponse.json({ error: 'Saknar siddata' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      facebook_page_id: pageId,
      facebook_page_name: pageName,
      facebook_page_access_token: pageToken,
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Kunde inte spara sidan' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
