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

/**
 * Downscales and re-encodes an image to JPEG in the browser before upload.
 *
 * This is what makes uploads work from phones: iPhone photos are HEIC (which the
 * storage buckets reject) and are often several MB (which exceeds the server
 * route's request-body limit → 413). Drawing the photo to a canvas and exporting
 * JPEG normalises the format (iOS can decode HEIC into a canvas), strips the odd
 * MIME types some mobile browsers send, respects EXIF orientation, and shrinks
 * the file well under the limits. Non-decodable inputs (e.g. video) are returned
 * untouched so the caller can still upload them as-is.
 */
export async function downscaleImage(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<Blob> {
  if (typeof document === "undefined") return file;
  // Skip obvious non-images (video) so they upload as-is.
  if (file.type && !file.type.startsWith("image/")) return file;

  const url = URL.createObjectURL(file);
  try {
    // <img> decode renders HEIC on iOS Safari (where phone photos come from) and
    // applies EXIF orientation; this matches the proven avatar resize path.
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = document.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = url;
    });
    if (!img || !img.naturalWidth) return file; // couldn't decode → upload original

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads an image, downscaling/re-encoding it to JPEG first (see
 * {@link downscaleImage}). Use this for image uploads from "use client"
 * components instead of {@link uploadFile} so phone photos work.
 */
export async function uploadImage(file: File, bucket: UploadBucket): Promise<string> {
  const blob = await downscaleImage(file);
  const isJpeg = blob !== file; // re-encoded → .jpg; otherwise keep original name
  return uploadFile(blob, bucket, isJpeg ? "image.jpg" : file.name);
}
