-- Momssats per evenemang.
--
-- Bakgrund (Ludvig 2026-11-04): entré till danstillställningar har 6 % moms
-- (9 kap. 14 § 2 ML). The Lab-practican räknas så från första kvällen i
-- november; zouken med workshop och allt som är undervisning, coaching och
-- uppdrag har 25 %. Satsen bodde bara i lokalens standardavtal, som är
-- gemensamt för alla kvällar på lokalen — därför kunde The Lab och zouken
-- inte ha olika satser, och Stripe räknade 25 % på allt.
--
-- listings.vat_rate: null = standard (Stripe Tax räknar, 25 %). Satt =
-- satsen gäller både i kassan (lib/stripe/vat) och i avräkningen mot lokalen.
-- En ny kväll i en serie ärver satsen från seriens senaste kväll, så att
-- ingen behöver komma ihåg att sätta den för hand.

alter table public.listings
  add column if not exists vat_rate numeric(4,3)
  check (vat_rate is null or vat_rate in (0, 0.06, 0.12, 0.25));

comment on column public.listings.vat_rate is
  'Momssats för det som säljs på det här evenemanget/kortet. null = standard (25 %, Stripe Tax). Styr kassan och avräkningen. Ärvs av nya kvällar i serien.';

-- Ärv satsen från seriens senaste kväll (samma arrangör).
create or replace function public.inherit_listing_vat_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vat_rate is null and new.series_slug is not null then
    select l.vat_rate into new.vat_rate
    from public.listings l
    where l.series_slug = new.series_slug
      and l.user_id = new.user_id
      and l.vat_rate is not null
    order by l.event_date desc nulls last, l.created_at desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inherit_listing_vat_rate on public.listings;
create trigger trg_inherit_listing_vat_rate
  before insert on public.listings
  for each row execute function public.inherit_listing_vat_rate();

-- Avräkningen: evenemangets egen sats går före lokalens standard.
create or replace function public.inherit_standing_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_date is not null and new.venue_profile_id is not null then
    insert into public.event_revenue_shares
      (listing_id, partner_profile_id, partner_percent, vat_rate, payout_delay_days)
    select new.id, d.venue_profile_id, d.partner_percent, coalesce(new.vat_rate, d.vat_rate), d.payout_delay_days
    from public.venue_revenue_share_defaults d
    where d.venue_profile_id = new.venue_profile_id
    on conflict (listing_id) do nothing;
  end if;

  if new.series_slug is not null then
    insert into public.event_access_codes
      (listing_id, code, label, max_uses, discount_price, is_active)
    select new.id, c.code, c.label, c.max_uses, c.discount_price, c.is_active
    from public.series_access_codes c
    where c.series_slug = new.series_slug and c.is_active
    on conflict (listing_id, code) do nothing;

    insert into public.listing_collaborators
      (listing_id, user_id, role, status, accepted_at, can_scan, can_manage, can_view_stats)
    select new.id, s.user_id, s.role, 'accepted', now(), s.can_scan, s.can_manage, s.can_view_stats
    from public.series_collaborators s
    where s.series_slug = new.series_slug
    on conflict (listing_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Data: The Lab torsdag från första kvällen i november, och seriens klippkort.
update public.listings
set vat_rate = 0.06
where series_id = 'c4a8fb90-d0ec-455f-be0d-269a00a2ea10'
  and event_date >= '2026-11-01';

update public.listings
set vat_rate = 0.06
where pass_series_id = 'c4a8fb90-d0ec-455f-be0d-269a00a2ea10'
   or 'c4a8fb90-d0ec-455f-be0d-269a00a2ea10' = any(pass_series_ids);
