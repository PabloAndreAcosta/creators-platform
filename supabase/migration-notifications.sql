-- In-app notifications
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null, -- 'booking_new', 'booking_confirmed', 'booking_canceled', 'payout', 'review', 'queue_promoted'
  title text not null,
  message text not null,
  link text, -- optional deep link (e.g. /dashboard/bookings)
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

comment on table public.notifications is 'In-app notification feed';
