// Downloads every object from the listed Supabase Storage buckets into a local
// staging directory, so the workflow can then rclone-sync it to Cloudflare R2.
//
// Why this instead of rclone's S3 backend: this Supabase project's dashboard
// does not expose dedicated S3 access keys, so we authenticate against the
// Storage REST API with the project's secret (service_role) key. Listing is
// required because the public buckets have no anonymous LIST policy (closed for
// security). Download uses the same authenticated endpoint so it works whether
// a bucket is public or private.
//
// Fails hard on any list/download error (non-zero exit) so the caller never
// rclone-syncs a partial/empty result over a good backup.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKETS = (process.env.BUCKETS || "avatars,creator-media,event-images,listing-images")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);
const OUT = process.env.STAGING_DIR || "staging";
const LIST_LIMIT = 100;

if (!SUPABASE_URL || !KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY env var");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Recursively list every object path under a bucket (Supabase returns "folder"
// rows with id === null that must be descended into).
async function listAll(bucket, prefix = "") {
  const paths = [];
  for (let offset = 0; ; offset += LIST_LIMIT) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: LIST_LIMIT,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix} -> ${res.status} ${await res.text()}`);
    const items = await res.json();
    for (const it of items) {
      const path = `${prefix}${it.name}`;
      if (it.id === null) {
        paths.push(...(await listAll(bucket, `${path}/`))); // folder -> recurse
      } else if (it.name !== ".emptyFolderPlaceholder") {
        paths.push(path);
      }
    }
    if (items.length < LIST_LIMIT) break;
  }
  return paths;
}

async function download(bucket, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, { headers });
  if (!res.ok) throw new Error(`get ${bucket}/${path} -> ${res.status}`);
  const dest = join(OUT, bucket, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

let total = 0;
for (const bucket of BUCKETS) {
  await mkdir(join(OUT, bucket), { recursive: true }); // ensure dir exists even if empty
  const paths = await listAll(bucket);
  console.log(`::group::${bucket}: ${paths.length} objects`);
  for (const p of paths) {
    await download(bucket, p);
    total++;
  }
  console.log("::endgroup::");
}
console.log(`Downloaded ${total} objects across ${BUCKETS.length} buckets.`);
