-- Let PostgREST embed profiles into listings, e.g. `listings.select("*, profiles(full_name, avatar_url)")`.
--
-- listings.user_id only had a FK to auth.users, so PostgREST could not resolve a
-- listings -> profiles relationship. Every query that embedded profiles into
-- listings therefore returned PGRST200 ("Could not find a relationship between
-- 'listings' and 'profiles'"), which the app swallowed to []. Effect: events were
-- unsearchable (/api/search, /app/search), missing from the home "Populära
-- evenemang" carousel (app/page.tsx), and from favorites (api/favorites).
--
-- profiles.id == auth.users.id and every listing.user_id has a matching profile
-- (verified: 0 orphans), so this second FK is safe and additive. It gives
-- PostgREST the relationship it needs; the auth.users FK stays for cascade.
alter table public.listings
  add constraint listings_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Refresh PostgREST's relationship cache so the embed resolves immediately.
notify pgrst, 'reload schema';
