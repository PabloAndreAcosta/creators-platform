-- Per-attendee tickets: buying N tickets in one order creates ONE booking with
-- guest_count=N and N ticket_attendees rows, each individually scannable and
-- checked in. Single-ticket bookings (guest_count=1) create NO attendee rows and
-- keep the existing booking-level QR/check-in path unchanged.
create table if not exists public.ticket_attendees (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  idx integer not null,
  name text,
  checked_in_at timestamptz,
  scanned_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_attendees_booking on public.ticket_attendees(booking_id);

alter table public.ticket_attendees enable row level security;

-- Read: the booking's creator (organizer) or its customer. Check-in writes go
-- through the service role after the endpoint's own scanner-permission check.
drop policy if exists "ticket_attendees read" on public.ticket_attendees;
create policy "ticket_attendees read" on public.ticket_attendees
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = ticket_attendees.booking_id
        and (b.creator_id = auth.uid() or b.customer_id = auth.uid())
    )
  );

-- reserve_ticket gains p_n so a multi-ticket order reserves N seats atomically
-- (capacity checked against sold + N). Older 2-arg signature dropped first.
drop function if exists public.reserve_ticket(uuid, uuid);
create or replace function public.reserve_ticket(p_listing uuid, p_ticket_type uuid default null, p_n integer default 1)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare cap integer; sold integer; n integer := greatest(coalesce(p_n,1), 1);
begin
  if p_ticket_type is not null then
    select capacity, coalesce(tickets_sold,0) into cap, sold
      from public.ticket_types where id = p_ticket_type and listing_id = p_listing for update;
    if not found then return false; end if;
    if cap is not null and sold + n > cap then return false; end if;
    update public.ticket_types set tickets_sold = coalesce(tickets_sold,0)+n where id = p_ticket_type;
    return true;
  else
    select capacity, coalesce(tickets_sold,0) into cap, sold
      from public.listings where id = p_listing for update;
    if cap is not null and sold + n > cap then return false; end if;
    update public.listings set tickets_sold = coalesce(tickets_sold,0)+n where id = p_listing;
    return true;
  end if;
end;
$$;
