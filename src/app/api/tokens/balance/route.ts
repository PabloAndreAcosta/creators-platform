import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTokenBalance } from "@/lib/tokens/balance";
import { ensureMonthlyAllowance } from "@/lib/tokens/allowance";

/** GET /api/tokens/balance — the signed-in user's nyckel balance. */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Lazily credit this month's tier allowance (idempotent per month) before the
  // read — so the pot appears the first time the user looks at their wallet.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();
  await ensureMonthlyAllowance(admin, user.id, profile?.tier);

  // RLS restricts the ledger read to the caller's own rows.
  const balance = await getTokenBalance(supabase, user.id);
  return NextResponse.json({ balance }, { headers: { "Cache-Control": "no-store" } });
}
