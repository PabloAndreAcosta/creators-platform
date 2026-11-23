-- Träningsvänpool (training-buddy pool): opt-in user↔user matching for finding
-- dance-practice partners. Mutual-like → match → chat. Candidate reads happen
-- ONLY via the service-role client (no public SELECT), like the event matcher.

-- ── training_buddy_profiles: opt-in + buddy-specific rich fields ──
create table if not exists public.training_buddy_profiles (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  is_active    boolean not null default true,             -- opt-in / pause switch
  dance_styles text[]  not null default '{}',             -- normalized lowercase
  style_levels jsonb   not null default '{}'::jsonb,       -- {"kizomba":"avancerad"}
  buddy_role   text    not null default 'both'
                 check (buddy_role in ('leader','follower','both')),
  availability jsonb   not null default '{}'::jsonb,        -- {"days":[...],"windows":[...]}
  city         text,
  lat          double precision,
  lon          double precision,
  radius_km    integer not null default 25 check (radius_km between 1 and 500),
  bio          text check (bio is null or char_length(bio) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.training_buddy_profiles enable row level security;

create policy "buddy profile own select" on public.training_buddy_profiles
  for select using (auth.uid() = profile_id);
create policy "buddy profile own insert" on public.training_buddy_profiles
  for insert with check (auth.uid() = profile_id);
create policy "buddy profile own update" on public.training_buddy_profiles
  for update using (auth.uid() = profile_id);
create policy "buddy profile own delete" on public.training_buddy_profiles
  for delete using (auth.uid() = profile_id);

create index if not exists idx_buddy_active
  on public.training_buddy_profiles(is_active) where is_active;

-- ── buddy_likes: directional like / pass ──
create table if not exists public.buddy_likes (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  action     text not null default 'like' check (action in ('like','pass')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

alter table public.buddy_likes enable row level security;

create policy "buddy_likes own insert" on public.buddy_likes
  for insert with check (auth.uid() = from_user);
create policy "buddy_likes own update" on public.buddy_likes
  for update using (auth.uid() = from_user);
create policy "buddy_likes party select" on public.buddy_likes
  for select using (auth.uid() = from_user or auth.uid() = to_user);

create index if not exists idx_buddy_likes_from on public.buddy_likes(from_user);
create index if not exists idx_buddy_likes_to   on public.buddy_likes(to_user);

-- ── buddy_matches: materialized reciprocal like (source of truth for "matched") ──
create table if not exists public.buddy_matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

alter table public.buddy_matches enable row level security;

create policy "buddy_matches party select" on public.buddy_matches
  for select using (auth.uid() = user_a or auth.uid() = user_b);
-- Inserts happen via the service-role client on reciprocity detection only.

create index if not exists idx_buddy_matches_a on public.buddy_matches(user_a);
create index if not exists idx_buddy_matches_b on public.buddy_matches(user_b);

-- Feature flag for later premium gating (mirrors matching_access; default open).
insert into public.app_config (key, value)
values ('buddy_access', '"open"'::jsonb)
on conflict (key) do nothing;
