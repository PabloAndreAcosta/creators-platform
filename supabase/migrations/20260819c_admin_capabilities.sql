-- Admin has been one boolean: whoever had it could do everything, and everything
-- is about to include more. Key partners are getting access, and a partner
-- helping with creator onboarding has no business creating or deleting discount
-- codes. Splitting the grant is easier before anyone holds it than after.
--
-- is_admin stays, and stays absolute: it means full admin, and it is what still
-- gates ticket check-in and the role switcher. This table is for granting one
-- slice of the admin surface to someone who should not have the rest.
create table if not exists public.admin_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, capability),
  -- Deliberately a closed list: an unrecognised string in a permissions table
  -- should be impossible, not merely unlikely. Adding an admin tool is a
  -- migration, which is the review step such a change deserves.
  constraint admin_capabilities_known check (capability in ('creators', 'promo'))
);

comment on table public.admin_capabilities is
  'One slice of the admin surface granted to a user. is_admin=true implies all of them.';
comment on column public.admin_capabilities.granted_by is
  'Who granted it — a permission with no trail is a permission nobody owns.';

create index if not exists idx_admin_capabilities_user
  on public.admin_capabilities(user_id);

alter table public.admin_capabilities enable row level security;

-- Nobody writes through the client. Grants go through a server action running as
-- service role, which checks the caller is a full admin first.
drop policy if exists "see own admin capabilities" on public.admin_capabilities;
create policy "see own admin capabilities" on public.admin_capabilities
  for select
  using (auth.uid() = user_id);

/**
 * The caller's effective admin capabilities.
 *
 * Returns ARRAY['*'] for a full admin — the menu and the guards read one list
 * either way, so "can do everything" doesn't need a second code path. Returns
 * an empty array for someone with no admin access at all.
 *
 * SECURITY DEFINER because is_admin is not readable as a column for
 * `authenticated`; no admin identity needs to sit in the client bundle.
 */
create or replace function public.current_user_admin_capabilities()
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  full_admin boolean;
  caps text[];
begin
  if auth.uid() is null then
    return array[]::text[];
  end if;

  select is_admin into full_admin from public.profiles where id = auth.uid();
  if full_admin is true then
    return array['*'];
  end if;

  select coalesce(array_agg(capability order by capability), array[]::text[])
    into caps
    from public.admin_capabilities
   where user_id = auth.uid();

  return caps;
end;
$$;

revoke all on function public.current_user_admin_capabilities() from public;
grant execute on function public.current_user_admin_capabilities() to authenticated;
