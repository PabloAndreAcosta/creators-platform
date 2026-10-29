-- Taxipass får en roll: taxidansare eller instruktör. Båda är volontärer på
-- samma villkor; rollen säger bara vad passet går ut på, och arrangören kan ha
-- olika antal platser för var och en på samma tid.
alter table public.taxi_shifts
  add column if not exists kind text not null default 'taxi' check (kind in ('taxi', 'instructor'));
