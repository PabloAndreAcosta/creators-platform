import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Serves PAID digital-product content via a short-lived signed URL, gated on
 * purchase. The content lives in the PRIVATE `digital-content` bucket, so it is
 * never world-readable — access is only ever a 5-minute signed URL minted here
 * after we confirm the caller is the product's creator or has bought it.
 *
 * GET /api/digital-content/<productId>?kind=video|file  → 302 redirect to the
 * signed URL (so it drops straight into <a href> / <video src>).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const kind = req.nextUrl.searchParams.get("kind") === "file" ? "file" : "video";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: product } = await admin
    .from("digital_products")
    .select("id, creator_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  }

  // Authorize: the creator (preview) or someone who has purchased it.
  let authorized = product.creator_id === user.id;
  if (!authorized) {
    const { count } = await admin
      .from("digital_purchases")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("buyer_id", user.id);
    authorized = (count ?? 0) > 0;
  }
  if (!authorized) {
    return NextResponse.json({ error: "Du äger inte den här produkten." }, { status: 403 });
  }

  const { data: content } = await admin
    .from("digital_product_content")
    .select("video_url, file_url")
    .eq("product_id", productId)
    .maybeSingle();
  const path = kind === "file" ? content?.file_url : content?.video_url;
  if (!path) {
    return NextResponse.json({ error: "Inget innehåll" }, { status: 404 });
  }

  // Legacy safety: if an old row still holds a full public URL (pre-private
  // bucket), just redirect to it rather than 500. New content stores a path.
  if (/^https?:\/\//i.test(path)) {
    return NextResponse.redirect(path);
  }

  const { data: signed, error } = await admin.storage
    .from("digital-content")
    .createSignedUrl(path, 300);
  if (error || !signed?.signedUrl) {
    console.error("digital-content signed URL failed:", { productId, kind, error });
    return NextResponse.json({ error: "Kunde inte hämta innehållet." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
