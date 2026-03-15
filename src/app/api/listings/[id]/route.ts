import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE — delete a listing
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Kunde inte ta bort tjänsten' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
