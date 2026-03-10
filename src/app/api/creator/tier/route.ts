import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCreatorCommissionRate } from '@/lib/stripe/commission';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tier, role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Profil hittades inte' },
        { status: 404 }
      );
    }

    const tier = profile.tier ?? 'gratis';
    const commission = getCreatorCommissionRate(tier);

    return NextResponse.json({
      tier,
      role: profile.role ?? 'publik',
      commission,
    });
  } catch (error) {
    console.error('Creator tier error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta tier' },
      { status: 500 }
    );
  }
}
