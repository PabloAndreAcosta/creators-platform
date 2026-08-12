import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/csp-report — collect Content-Security-Policy violation reports.
 *
 * Wired up via `report-uri` (legacy, Content-Type: application/csp-report) and
 * `report-to` (Reporting API, Content-Type: application/reports+json) in the
 * Report-Only CSP set in next.config.js. Reports are written to public.csp_reports
 * (RLS-locked, service_role only) so we can review real violations before
 * promoting the policy from Report-Only to enforced.
 *
 * Always responds 204 — a report endpoint must never surface errors back to the
 * browser. Best-effort insert; failures are swallowed.
 */
type Row = {
  document_uri?: string | null;
  referrer?: string | null;
  violated_directive?: string | null;
  effective_directive?: string | null;
  blocked_uri?: string | null;
  source_file?: string | null;
  line_number?: number | null;
  column_number?: number | null;
  status_code?: number | null;
  disposition?: string | null;
  user_agent?: string | null;
  raw: unknown;
};

const num = (v: unknown): number | null =>
  typeof v === "number" ? v : null;

// Bound what an unauthenticated caller can write via the service-role insert.
const MAX_REPORT_BYTES = 16 * 1024; // whole request body
const MAX_ROWS = 50; // reports per request (Reporting API batches)

// Only accept reports that claim to come from our own site — a CSP report's
// document_uri is the page that violated the policy, so a foreign origin means
// the report is spoofed/irrelevant and shouldn't reach our table.
const APP_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://usha.se").origin;
  } catch {
    return "https://usha.se";
  }
})();

function isOwnOrigin(documentUri: string | null | undefined): boolean {
  if (!documentUri) return true; // some reports omit it; don't over-filter
  try {
    return new URL(documentUri).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
    // Generous cap: a single page load can legitimately emit several reports,
    // but this still stops a single IP from flooding the table.
    const rl = rateLimit(getRateLimitKey(req, "csp-report"), 60, 60_000);
    if (!rl.allowed) return new NextResponse(null, { status: 204 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new NextResponse(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent");
    // Read as text first so we can bound the size before parsing / persisting.
    const text = await req.text().catch(() => "");
    if (!text || text.length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    if (!body) return new NextResponse(null, { status: 204 });

    const rows: Row[] = [];

    if (Array.isArray(body)) {
      // Reporting API (report-to): array of reports
      for (const r of body) {
        if (!r || typeof r !== "object") continue;
        const b = (r.body ?? {}) as Record<string, unknown>;
        rows.push({
          document_uri: (b.documentURL as string) ?? (r.url as string) ?? null,
          referrer: (b.referrer as string) ?? null,
          violated_directive: (b.violatedDirective as string) ?? null,
          effective_directive: (b.effectiveDirective as string) ?? null,
          blocked_uri: (b.blockedURL as string) ?? null,
          source_file: (b.sourceFile as string) ?? null,
          line_number: num(b.lineNumber),
          column_number: num(b.columnNumber),
          status_code: num(b.statusCode),
          disposition: (b.disposition as string) ?? null,
          user_agent: (r.user_agent as string) ?? ua,
          raw: r,
        });
      }
    } else {
      // Legacy report-uri: { "csp-report": { ... } }
      const b = (body["csp-report"] ?? body) as Record<string, unknown>;
      rows.push({
        document_uri: (b["document-uri"] as string) ?? null,
        referrer: (b["referrer"] as string) ?? null,
        violated_directive: (b["violated-directive"] as string) ?? null,
        effective_directive: (b["effective-directive"] as string) ?? null,
        blocked_uri: (b["blocked-uri"] as string) ?? null,
        source_file: (b["source-file"] as string) ?? null,
        line_number: num(b["line-number"]),
        column_number: num(b["column-number"]),
        status_code: num(b["status-code"]),
        disposition: (b["disposition"] as string) ?? null,
        user_agent: ua,
        raw: body,
      });
    }

    // Drop spoofed/foreign-origin reports and cap the batch size.
    const accepted = rows.filter((r) => isOwnOrigin(r.document_uri)).slice(0, MAX_ROWS);
    if (accepted.length) {
      const admin = createAdminClient();
      await admin.from("csp_reports").insert(accepted);
    }
  } catch {
    // never surface report-collection errors
  }
  return new NextResponse(null, { status: 204 });
}
