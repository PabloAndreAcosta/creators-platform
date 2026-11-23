-- Index för gallring av CSP-rapporter.
--
-- Gästbokningarnas namn RÖRS INTE (Pablo 2026-10-12): biljetten ska bära vem
-- den gäller. CSP-rapporter är något annat — ren felsökning som växer
-- obegränsat och bär user_agent och sidadress.

create index if not exists csp_reports_created_at_idx
  on public.csp_reports (created_at);
