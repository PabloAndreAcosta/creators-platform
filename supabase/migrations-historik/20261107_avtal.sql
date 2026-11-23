-- Avtal mellan två parter på plattformen.
--
-- Samarbeten (medarrangör, uppdrag/gage, lokal) ingicks utan att något stod
-- på papper. Här skriver den ena parten ett avtal från en mall, signerar och
-- skickar; motparten läser och signerar eller avböjer. Enkel e-signatur:
-- båda är inloggade med BankID-verifierade konton, och vi sparar vem, när,
-- från vilken adress och ett fingeravtryck av texten (content_hash) så att
-- ingen kan ändra i efterhand utan att det syns.
--
-- Alla skrivningar går via API:t med service-rollen; klienten får bara läsa
-- sina egna avtal. Status: draft → sent → signed | declined | withdrawn.
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  template_key text not null default 'free'
    check (template_key in ('cohost', 'gig', 'venue', 'free')),
  title text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'declined', 'withdrawn')),
  -- sha256 av titel + text när avtalet skickas; låser innehållet.
  content_hash text,
  sent_at timestamptz,
  creator_signed_at timestamptz,
  creator_sign_name text,
  creator_sign_ip text,
  creator_sign_ua text,
  counterparty_signed_at timestamptz,
  counterparty_sign_name text,
  counterparty_sign_ip text,
  counterparty_sign_ua text,
  declined_at timestamptz,
  decline_reason text,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by <> counterparty_id)
);

comment on table public.agreements is
  'Avtal mellan två konton, signerade med enkel e-signatur (BankID-verifierat konto + logg). Skrivs bara via API:t.';

create index if not exists agreements_created_by_idx on public.agreements (created_by, created_at desc);
create index if not exists agreements_counterparty_idx on public.agreements (counterparty_id, created_at desc);
create index if not exists agreements_listing_idx on public.agreements (listing_id);

-- Loggen: varje steg med vem och varifrån. Ändras aldrig.
create table if not exists public.agreement_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null
    check (kind in ('created', 'edited', 'sent', 'signed', 'declined', 'withdrawn', 'viewed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agreement_events_agreement_idx on public.agreement_events (agreement_id, created_at);

alter table public.agreements enable row level security;
alter table public.agreement_events enable row level security;

-- Parterna läser. Inga insert/update/delete-policies: alla skrivningar går
-- via service-rollen i API:t, som också sköter kontrollerna (Premium,
-- BankID, status).
create policy agreements_select_party on public.agreements for select
  using (created_by = (select auth.uid()) or counterparty_id = (select auth.uid()));

create policy agreement_events_select_party on public.agreement_events for select
  using (exists (
    select 1 from public.agreements a
    where a.id = agreement_id
      and (a.created_by = (select auth.uid()) or a.counterparty_id = (select auth.uid()))
  ));
