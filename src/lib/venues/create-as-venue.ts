import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vilken klient skriver ett nytt evenemang?
 *
 * Skapar personen åt sig själv går skrivningen genom hens egen session, och
 * RLS-policyn "Cleared sellers manage own listings" (auth.uid() = user_id)
 * gör kontrollen. Skapar en teammedlem åt lokalen ägs raden av LOKALEN — då
 * kan policyn aldrig släppa igenom den, eftersom auth.uid() är medlemmens.
 *
 * Vi vidgar inte policyn. En policy bred nog för medlemmen hade också låtit
 * hen skriva direkt mot PostgREST i varje evenemang lokalen äger, förbi
 * serverns prövning av behörigheten. I stället går lokalens rad genom
 * service-role, men FÖRST efter att anroparen prövat medlemskapet
 * (`venuesUserCanCreateFor`) — samma mönster som updateEvent och
 * toggleEventActive redan använder för medarrangörer.
 *
 * `createdBy` sätts bara när medlemskapet redan är prövat; det är det som gör
 * det säkert att lämna ut service-role här.
 */
export function listingWriterFor<C extends SupabaseClient>(
  own: C,
  createdBy: string | null,
  admin: () => C
): C {
  return createdBy ? admin() : own;
}
