/**
 * Uploads a file to a storage bucket via the authenticated server route
 * (`POST /api/storage/upload`). Use this from "use client" components instead of
 * calling `supabase.storage.from(...).upload()` directly — the server route
 * uploads as the authenticated user so the per-folder RLS policies pass even when
 * the browser client can't resolve the session from chunked cookies.
 *
 * Returns the public URL on success; throws Error(message) on failure so callers
 * can surface `error.message` in a toast.
 */
export type UploadBucket =
  | "event-images"
  | "listing-images"
  | "avatars"
  | "creator-media";

export async function uploadFile(
  file: File | Blob,
  bucket: UploadBucket,
  filename?: string,
): Promise<string> {
  const name = filename ?? (file instanceof File ? file.name : "upload.bin");
  const body = new FormData();
  body.append("file", file, name);
  body.append("bucket", bucket);

  const res = await fetch("/api/storage/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Uppladdning misslyckades");
  }
  return data.url as string;
}
