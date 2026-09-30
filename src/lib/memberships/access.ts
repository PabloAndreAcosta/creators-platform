/**
 * Medlemskap: gäller det i kväll, och gäller det här?
 *
 * Skilt från klippkortet med flit. Ett klippkort har N klipp och förbrukas.
 * Ett medlemskap har en period och förbrukas inte — samma medlem kan komma
 * varje kväll utan att något minskar. Det gör dörrens fråga till en annan:
 * inte "finns klipp kvar" utan "är medlemskapet giltigt i kväll, och täcker
 * det den här kvällen".
 *
 * AVSIKTLIG AVGRÄNSNING. Medlemskap är till för kreatörer som råder över sitt
 * eget utbud. En kväll som delas med en lokal via intäktsdelning ska aldrig
 * kunna öppnas med ett medlemskap: lokalen skulle då få en gäst som inte
 * betalat för just den kvällen, och vad de får för den gästen är en
 * förhandling, inte något koden kan hitta på. Se coversListing().
 */

export interface MembershipLike {
  status: string | null;
  current_period_end: string | null;
}

export interface MembershipPlanLike {
  creator_id: string;
  is_active: boolean | null;
  /** Serier medlemskapet ger tillträde till. Tom/null = kreatörens alla egna. */
  series_ids: string[] | null;
}

export interface ListingLike {
  user_id: string;
  series_id: string | null;
  /** Har kvällen en intäktsdelning med en lokal? */
  hasRevenueShare: boolean;
}

/**
 * Gäller medlemskapet just nu?
 *
 * DATUMET AVGÖR, INTE STATUS. En uppsagd prenumeration gäller perioden ut —
 * medlemmen har betalat för den. En "aktiv" som inte förnyats har gått ut,
 * hur fältet än ser ut. Läser man status i stället för datum nekar man någon
 * som betalat, eller släpper in någon som slutat betala.
 *
 * `past_due` släpps inte in: betalningen har faktiskt uteblivit. Att låta den
 * gälla perioden ut vore att ge bort kreatörens tjänst.
 */
/** Statusar som stänger dörren oavsett datum. `canceled` står medvetet INTE
 *  här: en uppsagd prenumeration gäller perioden ut. */
const NEKANDE_STATUS = new Set(["past_due", "expired"]);

export function isValidNow(m: MembershipLike, now: Date = new Date()): boolean {
  if (!m.current_period_end) return false;
  if (m.status && NEKANDE_STATUS.has(m.status)) return false;
  return new Date(m.current_period_end).getTime() > now.getTime();
}

/**
 * Täcker medlemskapet den här kvällen?
 *
 * Tre villkor, alla nödvändiga:
 *  1. Kvällen ägs av kreatören som säljer medlemskapet. Ett medlemskap hos en
 *     kreatör öppnar aldrig någon annans dörr.
 *  2. Kvällen delas inte med en lokal. Se filens inledning.
 *  3. Kvällen ligger i en serie medlemskapet gäller — eller så gäller
 *     medlemskapet alla kreatörens kvällar (tom lista).
 */
export function coversListing(plan: MembershipPlanLike, listing: ListingLike): boolean {
  if (!plan.is_active) return false;
  if (listing.user_id !== plan.creator_id) return false;
  if (listing.hasRevenueShare) return false;

  const series = (plan.series_ids ?? []).filter(Boolean);
  if (series.length === 0) return true;
  return !!listing.series_id && series.includes(listing.series_id);
}

/** Både giltigt och täckande. Det dörren behöver veta. */
export function grantsEntry(
  m: MembershipLike,
  plan: MembershipPlanLike,
  listing: ListingLike,
  now: Date = new Date()
): boolean {
  return isValidNow(m, now) && coversListing(plan, listing);
}
