-- Testdata för förhandsgrenar (en Supabase-gren per PR) och `supabase db reset`.
-- BARA påhittade uppgifter: inga riktiga namn, adresser, personnummer eller
-- Stripe-konton. Domänen sandbox.test kan aldrig ta emot mejl (RFC 2606).
--
-- Samma innehåll som scripts/seed-sandbox.mjs skapar lokalt:
--   arrangor@sandbox.test / sandbox-arrangor  (kreatör, verifierat företag)
--   kund@sandbox.test     / sandbox-kund      (kund)
--   /event/sandbox-event  med biljettypen Standard, 100 kr
-- Arrangören har inget Stripe-konto: betalningar på en förhandsversion går mot
-- Stripes testläge och kräver att ett testkonto kopplas för hand.

-- Kör som service_role så att skyddet av privilegierade profilkolumner släpper
-- igenom roll och företagsverifiering (protect_profile_privileged_columns).
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select set_config('request.jwt.claim.role', 'service_role', false);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'arrangor@sandbox.test',
   extensions.crypt('sandbox-arrangor', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Sandbox Arrangör AB"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'kund@sandbox.test',
   extensions.crypt('sandbox-kund', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Sandbox Kund"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from auth.users u
 where u.email in ('arrangor@sandbox.test', 'kund@sandbox.test')
on conflict do nothing;

-- handle_new_user har skapat profilerna; sätt det betalflödet läser.
-- Organisationsnumret är påhittat (giltig kontrollsiffra, inget registrerat bolag).
update public.profiles set
  full_name = 'Sandbox Arrangör AB', role = 'creator', email = 'arrangor@sandbox.test',
  company_verified_at = now(), company_name = 'Sandbox Arrangör AB',
  org_number = '5599000006', is_company = true
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set
  full_name = 'Sandbox Kund', role = 'customer', email = 'kund@sandbox.test'
where id = 'a0000000-0000-4000-8000-000000000002';

insert into public.listings (id, user_id, title, slug, category, description, is_public, event_date, event_city)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'Sandbox-event', 'sandbox-event', 'dance',
        'Testevent för förhandsgrenen. Inga riktiga pengar rör sig här.',
        true, now() + interval '14 days', 'Stockholm')
on conflict (id) do nothing;

insert into public.ticket_types (listing_id, name, price, capacity)
select 'b0000000-0000-4000-8000-000000000001', 'Standard', 100, 50
where not exists (select 1 from public.ticket_types where listing_id = 'b0000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '', false);
select set_config('request.jwt.claim.role', '', false);
