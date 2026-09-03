-- Behörigheten `page` fick ingen verkan.
--
-- Lokalens ägare kunde godkänna kopplingsförfrågningar, men en teammedlem som
-- fått "Lokalsidan" kunde det inte — funktionen frågade bara efter ägaren. Rutan
-- gick att kryssa i och sparades, men gjorde ingenting.
--
-- Nu släpps även en accepterad, ej borttagen medlem med `page` igenom. Villkoret
-- ligger i funktionen och inte i en policy, av samma skäl som förut: lokalen
-- äger inte evenemanget, och en policy bred nog att tillåta godkännandet hade
-- också låtit den ändra pris och titel på andras arrangemang.

create or replace function public.confirm_venue_listing(p_listing uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue uuid;
begin
  select venue_profile_id into v_venue from public.listings where id = p_listing;
  if v_venue is null then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  -- Ägaren, eller en medlem som håller `page` för just den lokalen.
  if v_venue <> auth.uid() and not exists (
    select 1 from public.venue_members m
     where m.venue_profile_id = v_venue
       and m.user_id = auth.uid()
       and m.accepted_at is not null
       and m.removed_at is null
       and 'page' = any(m.capabilities)
  ) then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;

  update public.listings
     set venue_confirmed_at = case when p_confirm then now() else null end
   where id = p_listing;
end;
$$;

revoke all on function public.confirm_venue_listing(uuid, boolean) from public;
revoke all on function public.confirm_venue_listing(uuid, boolean) from anon;
grant execute on function public.confirm_venue_listing(uuid, boolean) to authenticated;
