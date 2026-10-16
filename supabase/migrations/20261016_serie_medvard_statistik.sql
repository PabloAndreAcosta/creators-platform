-- Statistikbehörigheten ska ärvas till nya kvällar, inte tappas bort.
--
-- Bakgrund: listing_collaborators har tre behörigheter — can_scan, can_manage
-- och can_view_stats — men series_collaborators bär bara de två första.
-- Triggern inherit_standing_rules kunde därför omöjligt kopiera ner
-- statistiken, och en ny kväll gav medvärden skanning men aldrig insyn.
--
-- Felet märks inte när det sker. Medvärden ser kvällen i appen, kan skanna i
-- dörren, och upptäcker först i efterhand att siffrorna är borta — eller
-- upptäcker det aldrig, och ägaren tror att insynen gäller.
--
-- Standardvärdet är false: insynen är ägarens aktiva val, aldrig något som
-- råkar följa med. Se feedback_medkreator_insyn.

alter table public.series_collaborators
  add column if not exists can_view_stats boolean not null default false;

comment on column public.series_collaborators.can_view_stats is
  'Får medvärden se kvällens siffror? Ärvs till listing_collaborators när en ny kväll läggs in. Default false — insyn är ägarens aktiva val.';

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
    select new.id, d.venue_profile_id, d.partner_percent, d.vat_rate, d.payout_delay_days
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

    -- can_view_stats följer nu med. Utan den raden ärvde en ny kväll bara
    -- halva behörigheten, och skillnaden syntes först när någon letade efter
    -- siffror som inte fanns.
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

-- Återfyll serienivån ur de kvällar som redan finns.
--
-- De tre medvärdarna på the-lab-torsdag fick statistiken satt per kväll innan
-- den här kolumnen fanns. Utan återfyllningen hade serieraden sagt false och
-- nästa kväll tyst gett dem mindre än den förra — en regression införd av
-- precis den fix som skulle laga saken.
--
-- Villkoret är medvetet "alla kommande kvällar har insyn", inte "någon har".
-- En enstaka kväll där insynen getts tillfälligt ska inte bli en stående regel.
update public.series_collaborators s
set can_view_stats = true
where exists (
        select 1
        from public.listing_collaborators lc
        join public.listings l on l.id = lc.listing_id
        where lc.user_id = s.user_id
          and l.series_slug = s.series_slug
          and l.event_date >= current_date
          and lc.removed_at is null
      )
  and not exists (
        select 1
        from public.listing_collaborators lc
        join public.listings l on l.id = lc.listing_id
        where lc.user_id = s.user_id
          and l.series_slug = s.series_slug
          and l.event_date >= current_date
          and lc.removed_at is null
          and lc.can_view_stats = false
      );
