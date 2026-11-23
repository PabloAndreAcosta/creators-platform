-- Per-user storage accounting for the 2 GB creator quota.
--
-- Sums the bytes a user occupies across the app's upload buckets. Attribution
-- uses BOTH signals because the buckets contain two eras of objects:
--   * owner = p_user            -> legacy flat-named uploads (owner was set)
--   * name  like '<uid>/%'      -> current uploads at path `<user.id>/<uuid>`,
--                                  which the service-role upload route writes
--                                  with owner = NULL
-- A row matching both conditions is still counted once.
--
-- SECURITY DEFINER so it can read storage.objects; callable only by the
-- service-role client used by the storage upload routes.
create or replace function public.user_storage_bytes(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id in ('creator-media','listing-images','event-images','avatars')
    and (o.owner = p_user or o.name like p_user::text || '/%');
$$;

revoke all on function public.user_storage_bytes(uuid) from public;
grant execute on function public.user_storage_bytes(uuid) to service_role;
