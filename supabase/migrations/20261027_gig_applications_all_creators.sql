-- Uppdrag öppnas för alla kreatörer, inte bara taxidansare.
--
-- Den som saknar bolag anställs via Usha för passet (src/lib/assignments), så
-- beställaren blir aldrig arbetsgivare. Därför finns inget skäl att begränsa
-- vilka kreatörer som får söka. BankID-kravet ligger kvar.

drop policy if exists "Cleared taxi dancer applies" on public.gig_applications;

create policy "Cleared creator applies" on public.gig_applications
  for insert with check (
    applicant_id = (select auth.uid())
    and public.is_bankid_cleared((select auth.uid()))
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'creator'
    )
  );
