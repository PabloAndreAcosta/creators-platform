-- Multiple ticket TYPES / price tiers per event (e.g. Ordinarie / VIP / Student),
-- each with its own price and optional capacity. Backward compatible: a listing
-- with zero ticket_types rows behaves exactly as before (single listings.price).

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null,
  price integer not null default 0 check (price >= 0), -- kr, matches listings.price
  capacity integer check (capacity is null or capacity > 0),
  tickets_sold integer not null default 0 check (tickets_sold >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_types_listing on public.ticket_types(listing_id);

-- Persist the chosen type on the booking (id for joins, name denormalised for
-- display/emails so a later rename/delete doesn't blank historical tickets).
alter table public.bookings
  add column if not exists ticket_type_id uuid references public.ticket_types(id) on delete set null,
  add column if not exists ticket_type_name text;

alter table public.ticket_types enable row level security;

-- Prices aren't secret; the public sales page reads them anonymously.
drop policy if exists "ticket_types public read" on public.ticket_types;
create policy "ticket_types public read" on public.ticket_types
  for select using (true);

-- Only the event owner manages its types.
drop policy if exists "ticket_types owner manage" on public.ticket_types;
create policy "ticket_types owner manage" on public.ticket_types
  for all
  using (exists (select 1 from public.listings l where l.id = ticket_types.listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = ticket_types.listing_id and l.user_id = auth.uid()));

-- reserve_ticket / increment_tickets_sold gain an optional p_ticket_type: when
-- present, capacity is checked/decremented against the TYPE row instead of the
-- listing. Old 1-/2-arg signatures are dropped first to avoid overload ambiguity.
drop function if exists public.reserve_ticket(uuid);
create or replace function public.reserve_ticket(p_listing uuid, p_ticket_type uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare cap integer; sold integer;
begin
  if p_ticket_type is not null then
    select capacity, coalesce(tickets_sold,0) into cap, sold
      from public.ticket_types where id = p_ticket_type and listing_id = p_listing for update;
    if not found then return false; end if;
    if cap is not null and sold >= cap then return false; end if;
    update public.ticket_types set tickets_sold = coalesce(tickets_sold,0)+1 where id = p_ticket_type;
    return true;
  else
    select capacity, coalesce(tickets_sold,0) into cap, sold
      from public.listings where id = p_listing for update;
    if cap is not null and sold >= cap then return false; end if;
    update public.listings set tickets_sold = coalesce(tickets_sold,0)+1 where id = p_listing;
    return true;
  end if;
end;
$$;

drop function if exists public.increment_tickets_sold(uuid, integer);
create or replace function public.increment_tickets_sold(p_listing uuid, p_n integer default 1, p_ticket_type uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_ticket_type is not null then
    update public.ticket_types set tickets_sold = greatest(coalesce(tickets_sold,0)+p_n,0) where id = p_ticket_type;
  else
    update public.listings set tickets_sold = greatest(coalesce(tickets_sold,0)+p_n,0) where id = p_listing;
  end if;
end;
$$;
