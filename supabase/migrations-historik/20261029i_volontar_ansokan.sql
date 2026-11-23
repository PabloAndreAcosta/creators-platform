-- Volontärer ansöker och arrangören godkänner. Vem som helst får inte
-- taxidansa: man ansöker en gång per roll hos arrangören (eller i serien, t.ex.
-- The Lab), och när ansökan är godkänd kan man boka pass i den rollen fritt.
-- scope_key: 'series:<uuid>' om kvällen hör till en serie, annars 'host:<uuid>'
-- (samma avgränsning som varningarna).
create table if not exists public.volunteer_approvals (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null,
  role text not null,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  message text check (message is null or char_length(message) <= 500),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (scope_key, role, volunteer_id)
);
create index if not exists idx_volunteer_approvals_scope on public.volunteer_approvals (scope_key, status);
alter table public.volunteer_approvals enable row level security;
revoke all on public.volunteer_approvals from anon, authenticated;
