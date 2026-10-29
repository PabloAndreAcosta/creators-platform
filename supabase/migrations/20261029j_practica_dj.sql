-- Practica-kvällar, DJ som volontärroll och DJ-önskemål.
--
-- is_practica: kvällen har ingen bokad DJ. Bara då får en DJ ta ett pass som
-- volontär — annars ska en DJ alltid avlönas. Befintliga kvällar med
-- "Practica" i titeln markeras en gång — bara The Lab; zouk-tisdagarnas
-- "Practica, Workshop & Social" har DJ och lämnas. Därefter styr kryssrutan.
alter table public.listings add column if not exists is_practica boolean not null default false;
update public.listings set is_practica = true where title ilike 'The Lab%practica%' and is_practica = false;

ALTER TABLE public.taxi_shifts DROP CONSTRAINT IF EXISTS taxi_shifts_role_check;
ALTER TABLE public.taxi_shifts
  ADD CONSTRAINT taxi_shifts_role_check
  CHECK (role IN ('taxi_dancer', 'instructor', 'door_host', 'cashier', 'dj', 'photographer', 'helper'));

-- Gästerna önskar DJ:s till practicorna och röstar. Vid 50 röster lovar
-- arrangören att försöka boka DJ:n. Önskemålen hör till serien (annars
-- kvällen), som ansökningarna.
create table if not exists public.dj_wishes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null,
  name text not null check (char_length(name) between 2 and 80),
  link text check (link is null or char_length(link) <= 300),
  status text not null default 'open' check (status in ('open', 'booking', 'booked', 'hidden')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists dj_wishes_scope_name on public.dj_wishes (scope_key, lower(name));
create table if not exists public.dj_wish_votes (
  wish_id uuid not null references public.dj_wishes (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wish_id, voter_id)
);
alter table public.dj_wishes enable row level security;
alter table public.dj_wish_votes enable row level security;
revoke all on public.dj_wishes, public.dj_wish_votes from anon, authenticated;
