-- Reviews / Ratings table
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null unique,
  reviewer_id uuid references auth.users(id) on delete cascade not null,
  creator_id uuid references auth.users(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete cascade not null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_reviews_creator on public.reviews(creator_id);
create index if not exists idx_reviews_listing on public.reviews(listing_id);
create index if not exists idx_reviews_reviewer on public.reviews(reviewer_id);

-- RLS
alter table public.reviews enable row level security;

create policy "Anyone can view reviews"
  on public.reviews for select
  using (true);

create policy "Users can create reviews for their completed bookings"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id);

create policy "Users can update own reviews"
  on public.reviews for update
  using (auth.uid() = reviewer_id);

comment on table public.reviews is 'Customer reviews for completed bookings';
