-- Restore storage WRITE (INSERT/UPDATE/DELETE) policies for the image buckets.
--
-- Symptom: every client-side image upload — event images, avatars, listing
-- images, creator media — fails with
--   "new row violates row-level security policy".
-- Reproduced 2026-06-17 against the live project with a BankID-cleared admin
-- user: authenticated INSERT into all four buckets is denied, while the same
-- upload via service_role succeeds. So the buckets, MIME types and size limits
-- are fine — the INSERT policies on storage.objects are simply missing.
--
-- Cause: 20260603b_restrict_public_bucket_listing.sql dropped the broad
-- "Public read access" policy on storage.objects. That policy was FOR ALL, so
-- dropping it removed the WITH CHECK that authenticated uploads relied on — not
-- just the anonymous SELECT/listing exposure it was meant to close.
--
-- Downloads are unaffected: the buckets are public, so objects are served via
-- the CDN path (/storage/v1/object/public/...) which bypasses RLS entirely.
-- We therefore restore only WRITE access, scoped to each user's own top-level
-- folder where the app uploads that way.
--
-- App upload-path conventions (grep: supabase.storage.from(...).upload):
--   avatars         "<uid>/avatar.jpg"                 -> folder = uid
--   event-images    "<uid>/<uuid>.<ext>"               -> folder = uid
--   creator-media   "<uid>/..." (posts/products/...)   -> folder = uid
--   listing-images  "<timestamp>-<rand>.<ext>"         -> NO user folder (bucket root)
-- listing-images cannot be folder-scoped, so it is restricted to authenticated
-- users writing into that bucket, with UPDATE/DELETE limited to owned objects.

-- ---------------------------------------------------------------------------
-- Per-user-folder buckets: write access limited to the caller's own folder.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['avatars', 'event-images', 'creator-media']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_insert_own');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_update_own');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_delete_own');

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $f$, b || '_auth_insert_own', b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $f$, b || '_auth_update_own', b, b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)
    $f$, b || '_auth_delete_own', b);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- listing-images: app uploads to the bucket root (no per-user folder).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "listing-images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "listing-images_auth_update_own" ON storage.objects;
DROP POLICY IF EXISTS "listing-images_auth_delete_own" ON storage.objects;

CREATE POLICY "listing-images_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

CREATE POLICY "listing-images_auth_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'listing-images' AND owner = auth.uid());

CREATE POLICY "listing-images_auth_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND owner = auth.uid());
