import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { createClient } from "@supabase/supabase-js";
import {
  RETENTION_DAYS,
  anonymizedPatch,
  shouldAnonymize,
  type GuestBookingRow,
} from "@/lib/retention/guest-bookings";

/** Hur länge en CSP-rapport är värd något. Efter det är den brus. */
const CSP_RETENTION_DAYS = 30;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Gallring av det som inte ska sparas för alltid.
 *
 * Två spår:
 *
 * 1. GÄSTUPPGIFTER. En gästbokning bär namn och mejl på någon utan konto.
 *    180 dagar efter kvällen skrivs de över — raden blir kvar med belopp och
 *    datum, så bokföringen är obruten, men personen går inte längre att peka ut.
 *    Lagringsbegränsning är ett krav, inte en rekommendation.
 *
 * 2. CSP-RAPPORTER. Rena felrapporter utan nytta efter 30 dagar, men de växer
 *    obegränsat och bär user_agent och sidadress.
 *
 * ?dry_run=1 svarar med vad som SKULLE gallras utan att röra något. Gallring är
 * oåterkallelig, så den vägen finns för att kunna titta först.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const db = admin();
  const now = new Date();

  // Gästbokningar som ännu inte gallrats, med kvällens datum från listingen.
  const { data: rows, error } = await db
    .from("bookings")
    .select("id, guest_email, guest_name, created_at, anonymized_at, listings(event_date)")
    .not("guest_email", "is", null)
    .is("anonymized_at", null)
    .limit(1000);

  if (error) {
    console.error("data-retention: kunde inte läsa bokningar:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates: GuestBookingRow[] = (rows ?? []).map((r) => {
    // PostgREST ger relationen som objekt eller array beroende på kardinalitet.
    const rel = (r as unknown as { listings?: { event_date: string | null } | { event_date: string | null }[] | null }).listings;
    const listing = Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
    return {
      id: r.id as string,
      guest_email: r.guest_email as string | null,
      guest_name: r.guest_name as string | null,
      event_date: listing?.event_date ?? null,
      created_at: r.created_at as string,
      anonymized_at: r.anonymized_at as string | null,
    };
  });

  const due = candidates.filter((r) => shouldAnonymize(r, now));
  let anonymized = 0;
  const failed: string[] = [];

  if (!dryRun) {
    const patch = anonymizedPatch(now);
    for (const r of due) {
      // En rad i taget med anonymized_at-villkoret: två samtidiga körningar kan
      // inte skriva över samma rad två gånger.
      const { error: upErr } = await db
        .from("bookings")
        .update(patch)
        .eq("id", r.id)
        .is("anonymized_at", null);
      if (upErr) failed.push(r.id);
      else anonymized++;
    }
  }

  // CSP-rapporter äldre än fönstret. Här är radering rätt — de är felsökning,
  // inte underlag, och ingen siffra hänger på dem.
  const cspCutoff = new Date(now.getTime() - CSP_RETENTION_DAYS * 86_400_000).toISOString();
  let cspDeleted = 0;
  if (dryRun) {
    const { count } = await db
      .from("csp_reports")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cspCutoff);
    cspDeleted = count ?? 0;
  } else {
    const { data: gone, error: cspErr } = await db
      .from("csp_reports")
      .delete()
      .lt("created_at", cspCutoff)
      .select("id");
    if (cspErr) console.error("data-retention: CSP-rensning misslyckades:", cspErr.message);
    cspDeleted = gone?.length ?? 0;
  }

  return NextResponse.json({
    dry_run: dryRun,
    retention_days: RETENTION_DAYS,
    guest_bookings: {
      granskade: candidates.length,
      mogna: due.length,
      gallrade: dryRun ? 0 : anonymized,
      misslyckade: failed.length,
    },
    csp_reports: { retention_days: CSP_RETENTION_DAYS, [dryRun ? "mogna" : "raderade"]: cspDeleted },
  });
}
