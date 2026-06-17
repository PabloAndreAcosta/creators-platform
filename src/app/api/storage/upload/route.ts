import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Authenticated server-side file upload.
 *
 * Why this exists: direct browser uploads (`supabase.storage.from(...).upload()`)
 * hit Storage as `anon` and RLS rejects them with `new row violates row-level
 * security policy` (HTTP 400) — supabase-js attaches the publishable key (not the
 * user's session token) as the Storage bearer, on both browser AND server
 * clients. So we authenticate the request with the cookie-based server client
 * (getUser), then perform the upload with the service-role admin client, which
 * bypasses RLS. This is safe because the route fully controls the destination:
 * the bucket is allowlisted and the object path is always `<user.id>/<uuid>` —
 * the caller cannot choose the folder.
 */

type BucketName = "event-images" | "listing-images" | "avatars" | "creator-media";

// `singleton`: a user keeps exactly one file in this bucket. Upload to a stable
// path (`<user.id>/avatar.<ext>`) and delete any other files in the user's
// folder, so old avatars don't accumulate and the public URL stays stable.
const BUCKETS: Record<
  BucketName,
  { maxBytes: number; mimePrefixes: string[]; singleton?: boolean }
> = {
  "event-images": { maxBytes: 5 * 1024 * 1024, mimePrefixes: ["image/"] },
  "listing-images": { maxBytes: 5 * 1024 * 1024, mimePrefixes: ["image/"] },
  avatars: { maxBytes: 5 * 1024 * 1024, mimePrefixes: ["image/"], singleton: true },
  "creator-media": { maxBytes: 50 * 1024 * 1024, mimePrefixes: ["image/", "video/"] },
};

function isBucket(value: string): value is BucketName {
  return value in BUCKETS;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const bucket = String(formData.get("bucket") ?? "");

  if (!isBucket(bucket)) {
    return NextResponse.json({ error: "Okänd bucket" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil" }, { status: 400 });
  }

  const { maxBytes, mimePrefixes, singleton } = BUCKETS[bucket];
  if (!mimePrefixes.some((p) => file.type.startsWith(p))) {
    return NextResponse.json({ error: "Otillåten filtyp" }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Filen är för stor (max ${Math.round(maxBytes / 1024 / 1024)} MB)` },
      { status: 400 },
    );
  }

  // Folder = user id so the per-user storage RLS policies match. Singleton
  // buckets use a stable filename; others get a random one so history is kept.
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = singleton
    ? `${user.id}/avatar.${ext}`
    : `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  // Cleanup: for singleton buckets, remove any other files in the user's folder
  // (e.g. an old avatar.png when uploading avatar.jpg, or pre-existing leftovers).
  if (singleton) {
    const { data: existing } = await admin.storage.from(bucket).list(user.id);
    const stale = (existing ?? [])
      .map((o) => `${user.id}/${o.name}`)
      .filter((p) => p !== path);
    if (stale.length > 0) {
      await admin.storage.from(bucket).remove(stale);
    }
  }

  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl, path });
}
