import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTokenBalance } from "@/lib/tokens/balance";

/** GET /api/tokens/balance — the signed-in user's nyckel balance. */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS restricts the ledger read to the caller's own rows.
  const balance = await getTokenBalance(supabase, user.id);
  return NextResponse.json({ balance });
}
