import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side fallback for event-image uploads.
 *
 * The client uploads directly to the public `event-images` bucket. If the
 * bucket's storage RLS policies are missing/misconfigured (see
 * supabase/migrations/20260617_restore_storage_upload_policies.sql), that direct
 * upload fails with "new row violates row-level security policy" and event
 * creation is blocked. This route accepts the same file and uploads it with the
 * service-role client, which bypasses RLS, so hosts are never stuck.
 *
 * Note: requests here pass through the serverless function and are subject to
 * Vercel's ~4.5 MB body limit, whereas the direct client upload supports the
 * full 5 MB. Once the storage policies are restored the client never reaches
 * this fallback.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    const form = await req.formData();
    file = form.get("file");
  } catch {
    return NextResponse.json({ error: "Kunde inte läsa filen" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Ogiltig fil. Välj en bildfil (JPG, PNG eller WebP)." },
      { status: 400 }
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "För stor fil. Max 5 MB." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("event-images")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = admin.storage.from("event-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
