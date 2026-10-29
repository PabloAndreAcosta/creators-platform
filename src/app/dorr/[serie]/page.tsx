import type { Metadata } from "next";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { canonicalSeriesSlug } from "@/lib/listings/series-aliases";
import { pickOccurrence } from "@/lib/entrance/door-link";
import { hamtaKvallar, platsFor, type DoorScreenTicket } from "@/lib/entrance/door-occurrences";
import { stockholmToday } from "@/lib/time";
import { DoorScreen } from "./door-screen";

/**
 * Dörrskärmen: /dorr/<serie>
 *
 * Plattan i dörren. Visar kvällens biljetter som stora knappar; ett tryck ger
 * en QR-kod som gästen skannar och betalar i sin egen telefon.
 *
 * Läses ur databasen vid varje sidladdning. Tidigare låg skärmen som en
 * fristående sida med biljetterna inskrivna för hand, och den visade det gamla
 * programmet (practica/workshop/social/allt) långt efter att kvällarna blivit
 * "hela kvällen". Nu räcker det att ladda om för att se det som faktiskt säljs.
 *
 * Koderna pekar på /dorr/<serie>/<plats>, som myntar en egen betalning per
 * skanning — samma kod fungerar för hur många gäster som helst.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dörren – Usha",
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ serie: string }> };

export default async function DoorScreenPage({ params }: Params) {
  const { serie } = await params;
  const kanonisk = canonicalSeriesSlug(serie);
  const supabase = await createClient();

  const kvallar = await hamtaKvallar(supabase, kanonisk, serie);
  const kvall = pickOccurrence(kvallar, stockholmToday()) as (typeof kvallar)[number] | null;

  if (!kvall) {
    return <DoorScreen title={null} dateLabel={null} isToday={false} tickets={[]} />;
  }

  const { data: typer } = await supabase
    .from("ticket_types")
    .select("id, name, price, sort_order, capacity, tickets_sold")
    .eq("listing_id", kvall.id)
    .order("sort_order", { ascending: true });

  const alla = ((typer ?? []) as (DoorScreenTicket & { capacity: number | null; tickets_sold: number | null })[]);
  const kopbara = alla.filter((t) => t.capacity == null || (t.tickets_sold ?? 0) < t.capacity);

  const bas = (process.env.NEXT_PUBLIC_APP_URL || "https://usha.se").replace(/\/$/, "");
  const tickets = await Promise.all(
    kopbara.map(async (t) => {
      const url = `${bas}/dorr/${kanonisk}/${platsFor(t, alla)}`;
      // Felkorrigering M: tål reflexer på en skärm i en bar utan att mönstret
      // blir så tätt att en gammal telefonkamera tappar det.
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        color: { dark: "#0B0A0D", light: "#FFFFFF" },
      });
      return { id: t.id, name: t.name, price: t.price, url, svg };
    })
  );

  const datum = String(kvall.event_date).slice(0, 10);
  const dateLabel = new Date(`${datum}T12:00:00`).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DoorScreen
      title={kvall.title}
      dateLabel={dateLabel}
      isToday={datum === stockholmToday()}
      tickets={tickets}
    />
  );
}
