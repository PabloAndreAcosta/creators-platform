import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consentIdentity, shouldAskConsent } from "@/lib/venues/consent";

/**
 * Deltagarens ja eller nej till att höra från lokalen.
 *
 * Åtkomstmodellen är biljettsidans: den som har bokningens id har biljetten.
 * Samma nyckel som visar biljetten får ändra svaret på frågan som ställs där.
 * Gäster har ingen inloggning, så någon annan modell finns inte — och att kräva
 * konto för att kunna ÅTERKALLA hade gjort återkallelsen svårare än samtycket,
 * vilket inte är tillåtet.
 */

const SUPPORTED = ["sv", "en", "es"] as const;
type Locale = (typeof SUPPORTED)[number];

/**
 * Texten som personen faktiskt såg, återskapad på servern.
 *
 * Sparas som bevis. Den får INTE komma från klienten — då hade vad som helst
 * kunnat påstås ha visats.
 */
function consentText(locale: Locale, venue: string): string {
  switch (locale) {
    case "en":
      return `I want to hear from ${venue} about upcoming events. Usha sends on their behalf; ${venue} does not receive my details.`;
    case "es":
      return `Quiero recibir información de ${venue} sobre próximos eventos. Usha envía en su nombre; ${venue} no recibe mis datos.`;
    default:
      return `Jag vill höra från ${venue} om kommande arrangemang. Usha skickar å deras vägnar; ${venue} får inte mina uppgifter.`;
  }
}

export async function POST(req: NextRequest) {
  let body: { bookingId?: string; granted?: boolean; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }

  const { bookingId, granted } = body;
  if (!bookingId || typeof granted !== "boolean") {
    return NextResponse.json({ error: "bookingId och granted krävs" }, { status: 400 });
  }
  const locale: Locale = SUPPORTED.includes(body.locale as Locale) ? (body.locale as Locale) : "sv";

  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, guest_email, listing_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Biljetten hittades inte" }, { status: 404 });

  const { data: listing } = await admin
    .from("listings")
    .select("id, venue_profile_id, venue_confirmed_at")
    .eq("id", booking.listing_id)
    .maybeSingle();

  const identity = consentIdentity(booking);

  // Samma villkor som avgör om frågan visas avgör om svaret tas emot. Annars
  // hade ett svar kunnat postas för en obekräftad koppling.
  if (
    !shouldAskConsent({
      venueProfileId: listing?.venue_profile_id,
      venueConfirmedAt: listing?.venue_confirmed_at,
      identity,
    })
  ) {
    return NextResponse.json({ error: "Ingen lokal att svara för" }, { status: 400 });
  }

  const { data: venue } = await admin
    .from("profiles")
    .select("company_name, full_name")
    .eq("id", listing!.venue_profile_id!)
    .maybeSingle();

  const venueName = (venue?.company_name || venue?.full_name || "").trim() || "lokalen";
  const now = new Date().toISOString();

  // En rad per person och lokal. Ångrar man sig uppdateras raden i stället för
  // att en ny läggs till — annars går det inte att avgöra vad som gäller nu.
  const { error } = await admin.from("venue_marketing_consents").upsert(
    {
      venue_profile_id: listing!.venue_profile_id!,
      profile_id: identity!.profileId,
      email: identity!.email,
      granted_at: now,
      // Ett nej stämplas som återkallat i stället för att raden tas bort, så att
      // det går att visa att personen faktiskt svarat — och att slippa fråga om.
      withdrawn_at: granted ? null : now,
      consent_text: consentText(locale, venueName),
      locale,
      source_listing_id: listing!.id,
    },
    // subject är en genererad kolumn: coalesce(profile_id, lower(email)). Ett
    // vanligt unikt index på (venue_profile_id, subject) täcker både konton och
    // gäster. Två partiella index gick inte att göra upsert mot — Postgres kan
    // bara använda ett partiellt index som arbiter om satsen bär samma
    // WHERE-villkor, och det kan klienten inte skicka.
    { onConflict: "venue_profile_id,subject" }
  );

  if (error) {
    console.error("[venue-consent] kunde inte spara:", error.message);
    return NextResponse.json({ error: "Kunde inte spara svaret" }, { status: 500 });
  }

  return NextResponse.json({ state: granted ? "granted" : "withdrawn" });
}


/**
 * Den inloggades egna samtycken, för inställningssidan.
 *
 * Biljettlänken räcker juridiskt — den ligger i mejlet och slutar inte gälla, så
 * att ångra sig är lika lätt som att säga ja. Men den som raderat mejlet ska
 * inte stå utan väg, och den som har konto har en inställningssida att göra det
 * på.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  // RLS: policyn släpper bara igenom rader där profile_id = auth.uid().
  const { data } = await supabase
    .from("venue_marketing_consents")
    .select("venue_profile_id, granted_at, withdrawn_at, profiles!venue_profile_id(company_name, full_name)")
    .order("granted_at", { ascending: false });

  const items = (data ?? []).map((r) => {
    const v = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      venueProfileId: r.venue_profile_id,
      venueName: (v?.company_name || v?.full_name || "").trim() || "Okänd lokal",
      granted: !r.withdrawn_at,
    };
  });

  return NextResponse.json({ items });
}

/**
 * Återkalla eller återuppta, från inställningssidan.
 *
 * Går via användarens EGEN session och inte service_role: RLS-policyn tillåter
 * bara uppdatering av rader där profile_id = auth.uid(), vilket gör det
 * omöjligt att röra någon annans samtycke även om id:t gissas.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  let body: { venueProfileId?: string; granted?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }
  if (!body.venueProfileId || typeof body.granted !== "boolean") {
    return NextResponse.json({ error: "venueProfileId och granted krävs" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("venue_marketing_consents")
    .update(body.granted ? { granted_at: now, withdrawn_at: null } : { withdrawn_at: now })
    .eq("venue_profile_id", body.venueProfileId)
    .eq("profile_id", user.id);

  if (error) return NextResponse.json({ error: "Kunde inte spara" }, { status: 500 });
  return NextResponse.json({ granted: body.granted });
}
