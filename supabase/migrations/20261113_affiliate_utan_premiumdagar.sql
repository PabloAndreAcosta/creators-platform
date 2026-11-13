-- Partnerprogrammet efter en nivå (2026-11-13): premium-tid finns inte längre.
-- Första publicerade utbudet från en värvad kreatör eller lokal ger partnern
-- 50 kr kredit, samma som för en partner som inte säljer själv. Den värvade
-- får ingenting extra (allt ingår redan). Rader av sorten premium_days som
-- fortfarande väntar stängs. Kolumnerna och premium_grants ligger kvar som
-- historik.

create or replace function public.affiliate_on_first_listing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  v_ref uuid;
  v_prior integer;
begin
  if new.is_active is distinct from true then
    return new;
  end if;
  select referred_by into v_ref from public.profiles where id = new.user_id;
  if v_ref is null then
    return new;
  end if;
  select count(*) into v_prior from public.listings
    where user_id = new.user_id and is_active and id <> new.id;
  if v_prior > 0 then
    return new;
  end if;

  insert into public.affiliate_rewards (profile_id, referred_profile_id, kind, amount_ore, premium_days, ref, note)
  values (v_ref, new.user_id, 'credit', 5000, 0, 'first_listing:' || new.user_id || ':partner', 'Värvad profil publicerade sitt första utbud')
  on conflict (ref) do nothing;

  return new;
end;
$func$;

update public.affiliate_rewards
set status = 'void'
where kind = 'premium_days' and status = 'pending';
