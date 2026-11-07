import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { BODY_MAX, TEMPLATE_KEYS, TITLE_MAX, canWriteAgreements, logEvent, type TemplateKey } from "@/lib/agreements/model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/agreements — skapa ett utkast.
 * { counterpartyId, templateKey, title, body, listingId? }
 * Kräver Premium (eller betan). Motparten måste vara ett befintligt konto.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "agreements-create"), 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { counterpartyId?: string; templateKey?: string; title?: string; body?: string; listingId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const counterpartyId = String(payload.counterpartyId ?? "");
  const templateKey = String(payload.templateKey ?? "free") as TemplateKey;
  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const listingId = payload.listingId && UUID.test(payload.listingId) ? payload.listingId : null;

  if (!UUID.test(counterpartyId) || counterpartyId === user.id) return NextResponse.json({ error: "invalidCounterparty" }, { status: 400 });
  if (!TEMPLATE_KEYS.includes(templateKey)) return NextResponse.json({ error: "invalidTemplate" }, { status: 400 });
  if (!title || title.length > TITLE_MAX) return NextResponse.json({ error: "titleInvalid" }, { status: 400 });
  if (!body || body.length > BODY_MAX) return NextResponse.json({ error: "invalidBody" }, { status: 400 });

  const admin = createAdminClient();
  if (!(await canWriteAgreements(admin, user.id))) return NextResponse.json({ error: "premiumRequired" }, { status: 403 });

  const { data: other } = await admin.from("profiles").select("id").eq("id", counterpartyId).maybeSingle();
  if (!other) return NextResponse.json({ error: "invalidCounterparty" }, { status: 400 });

  if (listingId) {
    // Kopplingen till ett evenemang är bara en etikett, men den ska vara ens egen.
    const { data: l } = await admin.from("listings").select("id").eq("id", listingId).eq("user_id", user.id).maybeSingle();
    if (!l) return NextResponse.json({ error: "invalidListing" }, { status: 400 });
  }

  const { data: created, error } = await admin
    .from("agreements")
    .insert({ created_by: user.id, counterparty_id: counterpartyId, listing_id: listingId, template_key: templateKey, title, body })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "createFailed" }, { status: 500 });
  await logEvent(admin, created.id, user.id, "created", { templateKey });

  return NextResponse.json({ id: created.id });
}
