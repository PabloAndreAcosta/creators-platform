-- Favorites / Wishlist table
create table if not exists public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, listing_id)
);

-- Index for fast lookups
create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_favorites_listing on public.favorites(listing_id);

-- RLS
alter table public.favorites enable row level security;

create policy "Users can view own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can add favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

comment on table public.favorites is 'User wishlist / saved listings';
