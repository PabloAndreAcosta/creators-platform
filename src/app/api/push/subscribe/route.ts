import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Register (or refresh) the current user's Web Push subscription for this
// device. The browser hands us an endpoint + keys from pushManager.subscribe.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  // Upsert on the unique endpoint so re-subscribing (or the same device under a
  // new login) points to the current user instead of erroring.
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("push subscribe upsert failed:", error);
    return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Remove this device's subscription (toggle off / logout).
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let endpoint: string | undefined;
  try {
    endpoint = (await req.json())?.endpoint;
  } catch {
    /* ignore — fall through to 400 below */
  }
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
