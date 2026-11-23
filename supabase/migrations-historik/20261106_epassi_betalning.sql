-- Klippkort betalda med friskvårdsbidrag via Epassi.
--
-- Epassi har inget API i Sverige: kunden betalar i Epassi-appen och vi ser
-- köpet i Epassis leverantörsportal. Därför skapas bokningen här som
-- 'pending' när kunden väljer Epassi i Usha, och arrangören bekräftar den för
-- hand ("Betald i Epassi") när köpet syns i portalen. Först då sätts
-- amount_paid och giltighetstiden, och QR-koden börjar fungera i dörren.
--
-- payment_method är null för allt som betalas via Stripe (som förut). Bara
-- 'epassi' är tillåtet än så länge; fler externa betalsätt läggs till i
-- check-villkoret när de finns.
alter table public.bookings
  add column if not exists payment_method text
  constraint bookings_payment_method_check check (payment_method is null or payment_method in ('epassi'));

comment on column public.bookings.payment_method is
  'Externt betalsätt. null = Stripe/gratis som tidigare. ''epassi'' = friskvårdsbidrag via Epassi, bekräftas manuellt.';

create index if not exists bookings_epassi_pending_idx
  on public.bookings (creator_id, created_at desc)
  where payment_method = 'epassi';
