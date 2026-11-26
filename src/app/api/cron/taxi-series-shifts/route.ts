import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inheritSeriesShifts } from "@/lib/taxi/inherit";
import { stockholmToday } from "@/lib/time";

/**
 * Cron (varje natt): nya kvällar i en serie får seriens volontärpass.
 * Se src/lib/taxi/inherit.ts för reglerna.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await inheritSeriesShifts(createAdminClient(), { today: stockholmToday() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("taxi-series-shifts failed:", error);
    return NextResponse.json({ error: "inherit" }, { status: 500 });
  }
}
