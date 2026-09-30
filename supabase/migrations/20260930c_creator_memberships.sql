-- Medlemskap som en kreatör kan erbjuda sina egna deltagare.
--
-- Ett verktyg, inte ett tvång: en kreatör som inte vill ha det lägger aldrig
-- upp något, och ingenting i hens flöde ändras. Tänkt för den som RÅDER ÖVER
-- SITT EGET UTBUD — egen studio, egna kvällar, online — där "gå hur mycket du
-- vill" är ett löfte kreatören faktiskt kan hålla.
--
-- Därför finns här ingen lokalavräkning. Ett medlemskap på en kväll som delas
-- med en lokal skulle kräva ett svar på vad lokalen får för en gäst som inte
-- betalat för just den kvällen, och det svaret är en förhandling, inte kod.
-- Medlemskap kopplas bara till kvällar kreatören äger själv.

create table if not exists creator_memberships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  price_ore integer not null check (price_ore >= 0),
  interval text not null default 'month' check (interval in ('month', 'year')),
  series_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table creator_memberships is
  'Medlemskap en kreatör erbjuder sina deltagare. Opt-in per kreatör; gäller bara kvällar kreatören äger själv.';

create index if not exists creator_memberships_creator_idx
  on creator_memberships (creator_id) where is_active;

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  creator_membership_id uuid not null references creator_memberships(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz not null,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_membership_id, member_id)
);

comment on table memberships is
  'En deltagares medlemskap. current_period_end avgör giltighet i dörren, inte status.';

create index if not exists memberships_member_idx on memberships (member_id);

create table if not exists membership_entries (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  scanned_by uuid references profiles(id) on delete set null,
  entered_at timestamptz not null default now(),
  unique (membership_id, listing_id)
);

comment on table membership_entries is
  'Medlems närvaro på en kväll. Inget förbrukas — unik nyckel hindrar dubbelskanning.';

alter table creator_memberships enable row level security;
alter table memberships enable row level security;
alter table membership_entries enable row level security;

create policy "creator_memberships_public_read" on creator_memberships
  for select using (is_active);

create policy "creator_memberships_owner_all" on creator_memberships
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create policy "memberships_self_read" on memberships
  for select using (
    auth.uid() = member_id
    or exists (
      select 1 from creator_memberships cm
      where cm.id = creator_membership_id and cm.creator_id = auth.uid()
    )
  );

create policy "membership_entries_read" on membership_entries
  for select using (
    exists (
      select 1 from memberships m
      join creator_memberships cm on cm.id = m.creator_membership_id
      where m.id = membership_id and (m.member_id = auth.uid() or cm.creator_id = auth.uid())
    )
  );
