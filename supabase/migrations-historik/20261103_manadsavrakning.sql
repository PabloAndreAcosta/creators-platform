-- Månadsavräkning till partnern.
--
-- Andelen betalas kväll för kväll, men partnerns ekonomi behöver ett samlat
-- underlag per månad. Underlaget mejlas första vardagen i månaden till
-- adresserna på avtalet, med kopia till Ushas ekonomilista.

-- Vem hos partnern som ska få avräkningen (ofta ekonomin, inte kontoägaren).
alter table public.venue_revenue_share_defaults
  add column if not exists statement_emails text[] not null default '{}';

comment on column public.venue_revenue_share_defaults.statement_emails is
  'Mottagare av månadsavräkningen hos partnern. Tom = bara Ushas ekonomilista får den.';

-- En rad per partner och månad. Raden gör utskicket idempotent: cron kör varje
-- dag, men partnern får månaden en gång. partner_sent_at är null så länge
-- partnern saknar adress — läggs en adress till senare skickas månaden då.
create table if not exists public.settlement_statements (
  id                 uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.profiles(id) on delete cascade,
  period             text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  recipients         text[] not null default '{}',
  totals             jsonb not null,
  internal_sent_at   timestamptz,
  partner_sent_at    timestamptz,
  created_at         timestamptz not null default now(),
  unique (partner_profile_id, period)
);

alter table public.settlement_statements enable row level security;
revoke all on public.settlement_statements from anon, authenticated;
