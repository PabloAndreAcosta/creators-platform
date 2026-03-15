-- User settings (notifications + privacy preferences)
create table if not exists public.user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  -- Notification preferences
  notif_booking_new boolean default true not null,
  notif_booking_confirmed boolean default true not null,
  notif_booking_canceled boolean default true not null,
  notif_payout boolean default true not null,
  notif_marketing boolean default false not null,
  -- Privacy preferences
  privacy_public_profile boolean default true not null,
  privacy_show_location boolean default true not null,
  privacy_show_reviews boolean default true not null,
  privacy_booking_history boolean default false not null,
  -- Timestamps
  updated_at timestamptz default now() not null
);

alter table public.user_settings enable row level security;

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can upsert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

comment on table public.user_settings is 'User notification and privacy preferences';
