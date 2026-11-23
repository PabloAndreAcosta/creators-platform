-- ---------------------------------------------------------------------------
-- Tillägg till baslinjen: det som produktionen har utanför schemat public.
-- Hämtat ur produktionens katalog 2026-11-23 (pg_policies, storage.buckets,
-- pg_trigger på auth.users). Bara struktur, inga uppgifter om användare.
-- ---------------------------------------------------------------------------

-- Ny användare i auth.users => profilrad. Utan den fallerar varje främmande
-- nyckel mot profiles.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lagringsbuckets (samma gränser som i produktionen)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars',        'avatars',        true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('event-images',   'event-images',   true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('listing-images', 'listing-images', true,  5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('creator-media',  'creator-media',  true,  52428800,   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']),
  ('digital-content','digital-content',false, 5368709120, NULL)
ON CONFLICT (id) DO NOTHING;

-- Policyer på storage.objects
create policy "Authenticated users can upload" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'event-images'::text])));
create policy "Authenticated users can upload event images" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'event-images'::text));
create policy "Users can delete own avatar" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can delete own event images" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own avatar" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own event images" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can update own files" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = ANY (ARRAY['avatars'::text, 'listing-images'::text, 'event-images'::text])) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can upload own avatar" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can upload own media" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'creator-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "creator-media_auth_insert_own" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'creator-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own delete" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own insert" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "digital-content own update" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'digital-content'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "event-images_auth_delete_own" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "event-images_auth_update_own" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'event-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
