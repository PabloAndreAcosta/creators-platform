-- Betalda pass: DJ och andra kreatörer kan ta pass mot ersättning.
--
-- pay_ore = arrangörens totala kostnad per person för passet (0 = volontär).
-- För den utan bolag är det lönebudgeten (lön + semesterersättning +
-- arbetsgivaravgift); den med bolag fakturerar beloppet. En DJ utanför
-- practicorna måste ha ett betalt pass.
alter table public.taxi_shifts
  add column if not exists pay_ore integer not null default 0 check (pay_ore between 0 and 1000000);

-- Löneraderna kan nu komma från ett pass i stället för en bokning: exakt en
-- av booking_id och shift_signup_id är satt. Momsen och provisionen är 0 för
-- pass — ingen försäljning, det är arrangörens egen kostnad.
alter table public.payroll_shadow_lines alter column booking_id drop not null;
alter table public.payroll_shadow_lines
  add column if not exists shift_signup_id uuid unique references public.taxi_signups (id) on delete cascade;
alter table public.payroll_shadow_lines drop constraint if exists payroll_shadow_source;
alter table public.payroll_shadow_lines
  add constraint payroll_shadow_source check ((booking_id is null) <> (shift_signup_id is null));
