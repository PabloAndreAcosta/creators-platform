-- Security-advisor fix (public_bucket_allows_listing), 2026-06-03.
--
-- The buckets avatars / creator-media / event-images / listing-images are all
-- `public = true`, so file downloads are served via the public CDN path
-- (/storage/v1/object/public/...) which BYPASSES RLS entirely. The broad SELECT
-- policies on storage.objects are therefore not needed for the app — it only
-- ever calls getPublicUrl()/upload(), never .list(). Their only effect is to let
-- ANY client (incl. anon) enumerate every filename in the bucket via .list().
--
-- Verified empirically before applying: a public object URL returns HTTP 200
-- with no auth and no SELECT policy dependency. Removing these SELECT policies
-- stops anonymous listing without affecting downloads or uploads.
--
-- Note: dropping the per-bucket "Anyone can view ..." policies alone is not
-- enough — the array policy "Public read access" still exposes avatars/
-- listing-images/event-images. All four broad SELECT policies are removed.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view creator media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
