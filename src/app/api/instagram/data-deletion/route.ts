import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

/**
 * Instagram Data Deletion Callback
 * Meta requires apps to handle user data deletion requests.
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

  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const signedRequest = formData.get("signed_request") as string;

  if (!signedRequest) {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const data = parseSignedRequest(signedRequest, IG_APP_SECRET);
  if (!data) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const igUserId = String(data.user_id);

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Clear Instagram data for this user
  await supabase
    .from("profiles")
    .update({
      instagram_user_id: null,
      instagram_username: null,
      instagram_access_token: null,
    })
    .eq("instagram_user_id", igUserId);

  // Meta expects a JSON response with a confirmation URL and a tracking code
  const confirmationCode = crypto.randomUUID();
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

  return NextResponse.json({
    url: `${APP_URL}/privacy`,
    confirmation_code: confirmationCode,
  });
}
