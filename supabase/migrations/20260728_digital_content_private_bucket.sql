-- Private bucket for PAID digital-product content (course videos / files).
--
-- Paid content was uploaded to the PUBLIC `creator-media` bucket and its public
-- URL stored in digital_product_content. RLS protected the URL ROW but the file
-- at /storage/v1/object/public/creator-media/... was world-readable → the
-- paywall was bypassable by anyone with the link. This bucket is PRIVATE: files
-- are served only via short-lived signed URLs generated server-side after a
-- purchase check (see /api/digital-content/[productId]).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('digital-content', 'digital-content', false, 5368709120)  -- 5 GB
ON CONFLICT (id) DO NOTHING;

-- Creators may write objects only in their own <user.id>/ folder. There is NO
-- public/authenticated SELECT policy: reads happen exclusively through
-- service-role-signed URLs (which bypass RLS), so no one can list or fetch a
-- file directly, even authenticated.
DROP POLICY IF EXISTS "digital-content own insert" ON storage.objects;
CREATE POLICY "digital-content own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-content' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "digital-content own update" ON storage.objects;
CREATE POLICY "digital-content own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'digital-content' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "digital-content own delete" ON storage.objects;
CREATE POLICY "digital-content own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'digital-content' AND (storage.foldername(name))[1] = auth.uid()::text);
