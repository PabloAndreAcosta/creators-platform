-- Gage (fee) agreements between an event host and a crew member.
-- Either party proposes an amount; the other accepts; the host pays via Stripe
-- (destination charge to the crew member's Connect account).
create table if not exists gage_agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  collaborator_user_id uuid not null references auth.users(id) on delete cascade,
  amount_ore integer not null check (amount_ore > 0),
  proposed_by text not null check (proposed_by in ('host','crew')),
  status text not null default 'proposed' check (status in ('proposed','agreed','paid','canceled')),
  note text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  agreed_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz
);

-- At most one active (proposed/agreed) agreement per host↔crew pair on a listing.
create unique index if not exists gage_active_unique
  on gage_agreements (listing_id, collaborator_user_id)
  where status in ('proposed','agreed');

create index if not exists gage_collaborator_idx on gage_agreements (collaborator_user_id);
create index if not exists gage_listing_idx on gage_agreements (listing_id);

alter table gage_agreements enable row level security;

create policy gage_select_party on gage_agreements for select
  using (host_id = (select auth.uid()) or collaborator_user_id = (select auth.uid()));

create policy gage_insert_party on gage_agreements for insert
  with check (host_id = (select auth.uid()) or collaborator_user_id = (select auth.uid()));

create policy gage_update_party on gage_agreements for update
  using (host_id = (select auth.uid()) or collaborator_user_id = (select auth.uid()));
