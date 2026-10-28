-- Skuggraderna blir underlag till SAMekonomi när lönevägen är i drift.
--
-- live      — uppdraget betalades faktiskt till Usha. Bara sådana rader får
--             skickas som underlag; övriga är ren skuggräkning.
-- sam_*     — när raden skickades till SAMekonomi och mot vilken samlingsfaktura.
--             En skickad rad skickas aldrig igen.
-- voided_at — uppdraget återbetalades INNAN underlaget skickats: raden ska
--             inte med. Återbetalning EFTER blir i stället en skuld i
--             creator_debts, eftersom en utbetald lön inte går att backa.

alter table public.payroll_shadow_lines
  add column if not exists live boolean not null default false,
  add column if not exists sam_submitted_at timestamptz,
  add column if not exists sam_reference text,
  add column if not exists voided_at timestamptz;

create index if not exists idx_payroll_shadow_lines_pending
  on public.payroll_shadow_lines (creator_id)
  where live and sam_submitted_at is null and voided_at is null;
