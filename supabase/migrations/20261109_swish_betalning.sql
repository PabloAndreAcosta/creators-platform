-- Biljetter betalda med Swish i dörren (Swish Företag via Nordea, avtal 565622).
--
-- Gästen skannar en Swish-QR på entréskärmen och betalar i Swish-appen;
-- den som står i dörren ser betalningen och registrerar bokningen som
-- 'swish'. Pengarna landar på Usha AB:s bankkonto, utanför Stripe, så
-- raderna hålls utanför den automatiska avräkningen och redovisas separat.
alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method is null or payment_method in ('epassi', 'swish'));

comment on column public.bookings.payment_method is
  'Externt betalsätt. null = Stripe/gratis. ''epassi'' = friskvårdsbidrag via Epassi, bekräftas manuellt. ''swish'' = Swish Företag i dörren, registreras av entrévärden.';

create index if not exists bookings_swish_idx
  on public.bookings (listing_id, created_at desc)
  where payment_method = 'swish';

-- Swish-numret: ändras i databasen, ingen deploy. Tomt = Swish av.
insert into public.app_config (key, value)
values ('swish_number', '"1237111180"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
