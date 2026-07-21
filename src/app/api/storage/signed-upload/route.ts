import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStorageQuota, bytesToMb, STORAGE_QUOTA_BYTES } from "@/lib/storage/quota";

export const runtime = "nodejs";

/**
 * Issues a short-lived signed upload URL so the browser can upload large files
 * (e.g. video) DIRECTLY to Storage.
 *
 * Why: the byte-proxying route (`/api/storage/upload`) runs through a serverless
 * function with a ~4.5 MB request-body limit, so anything bigger 413s. A signed
 * upload URL is created server-side (after authenticating the user) and the
 * client PUTs straight to Storage — no function body limit; the bucket still
 * enforces its size/MIME limits. The signed token authorizes the specific
 * server-chosen path `<user.id>/<uuid>.<ext>`, so the caller can't pick the
 * bucket or folder, and no user session is needed on the upload itself.
 */

const BUCKETS = new Set(["event-images", "listing-images", "avatars", "creator-media"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const { bucket, ext, size } = await request.json().catch(() => ({}));
  if (typeof bucket !== "string" || !BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Okänd bucket" }, { status: 400 });
  }

  const safeExt = typeof ext === "string" && /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : "bin";
  const path = `${user.id}/${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();

  // Per-account total storage quota (2 GB). The client declares the file size;
  // the bucket's own hard size limit still backstops the actual PUT.
  const declaredBytes = typeof size === "number" && size > 0 ? size : 0;
  const quota = await checkStorageQuota(admin, user.id, declaredBytes);
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: `Lagringsutrymmet är fullt (max ${bytesToMb(STORAGE_QUOTA_BYTES) / 1024} GB). ${bytesToMb(quota.remaining)} MB kvar — ta bort material för att frigöra utrymme.`,
      },
      { status: 413 },
    );
  }
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Kunde inte skapa uppladdnings-URL" },
      { status: 400 },
    );
  }

  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: urlData.publicUrl });
}
