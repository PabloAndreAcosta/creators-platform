import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createClient } from "@supabase/supabase-js";

/** Hur länge en CSP-rapport är värd något. Efter det är den brus. */
const CSP_RETENTION_DAYS = 30;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Gallring av CSP-rapporter.
 *
 * Rena felrapporter: de bär user_agent och sidadress, växer obegränsat och är
 * värdelösa efter en månad. Här är radering rätt — de är felsökning, inte
 * underlag, och ingen siffra hänger på dem.
 *
 * GÄSTBOKNINGAR RÖRS INTE. Namnet på en biljett är vem biljetten gäller, och
 * det ska stå kvar (Pablo 2026-10-12). Vägen till färre personuppgifter går via
 * samtycke och följarregistret, inte via att tömma biljetter i efterhand.
 *
 * ?dry_run=1 svarar med vad som SKULLE raderas utan att röra något.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const db = admin();
  const cutoff = new Date(Date.now() - CSP_RETENTION_DAYS * 86_400_000).toISOString();

  if (dryRun) {
    const { count } = await db
      .from("csp_reports")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoff);
    return NextResponse.json({
      dry_run: true,
      csp_reports: { retention_days: CSP_RETENTION_DAYS, mogna: count ?? 0 },
    });
  }

  const { data: gone, error } = await db
    .from("csp_reports")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("data-retention: CSP-rensning misslyckades:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    dry_run: false,
    csp_reports: { retention_days: CSP_RETENTION_DAYS, raderade: gone?.length ?? 0 },
  });
}
