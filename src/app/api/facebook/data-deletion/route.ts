import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

/**
 * Facebook Data Deletion Callback
 * Meta requires apps to handle user data deletion requests for Facebook Login.
 * See: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

function parseSignedRequest(signedRequest: string, secret: string) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest();

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const signedRequest = formData.get("signed_request") as string;

  if (!signedRequest) {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const data = parseSignedRequest(signedRequest, FB_APP_SECRET);
  if (!data) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const fbUserId = String(data.user_id);
  const confirmationCode = crypto.randomUUID();

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from("data_deletion_requests").insert({
    provider: "facebook",
    external_user_id: fbUserId,
    confirmation_code: confirmationCode,
    received_at: new Date().toISOString(),
  });

  await supabase
    .from("social_connections")
    .update({
      facebook_page_id: null,
      facebook_page_name: null,
      facebook_page_access_token: null,
      facebook_user_id: null,
    })
    .eq("facebook_user_id", fbUserId);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

  return NextResponse.json({
    url: `${APP_URL}/data-deletion/${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
