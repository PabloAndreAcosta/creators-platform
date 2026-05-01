import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Återbetalningspolicy | Usha",
  description: "Så fungerar avbokning och återbetalning på Usha.",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Tillbaka
      </Link>

      <h1 className="text-3xl font-bold">Återbetalningspolicy</h1>
      <p className="mt-2 text-sm text-[var(--usha-muted)]">
        Senast uppdaterad: 2026-05-01
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Översikt</h2>
          <p>
            Usha förmedlar bokningar mellan kunder, kreatörer och arrangörer. När du avbokar
            en betald bokning innan den är slutförd får du en full återbetalning till samma kort
            som användes vid betalningen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Avbokning</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="text-white">Pågående bokning (status: väntande):</strong>{" "}
              Kund eller kreatör kan avboka när som helst. Eventuell betalning återbetalas i sin helhet.
            </li>
            <li>
              <strong className="text-white">Bekräftad bokning (status: bekräftad):</strong>{" "}
              Kund eller kreatör kan avboka. Eventuell betalning återbetalas i sin helhet.
            </li>
            <li>
              <strong className="text-white">Slutförd bokning (status: slutförd):</strong>{" "}
              Bokningen kan inte avbokas via plattformen. Kontakta motparten direkt eller{" "}
              <a
                href="mailto:support@usha.se"
                className="text-[var(--usha-gold)] hover:underline"
              >
                support@usha.se
              </a>{" "}
              för en manuell utredning.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Specifikt för danspaket (taxidansare)
          </h2>
          <p>
            Ett danspaket är en förbetald produkt med ett specifikt antal danser som inlöses
            successivt på event. När en eller flera danser har inlösts räknas paketet som delvis
            konsumerat. Paketet kan endast återbetalas i sin helhet om{" "}
            <strong className="text-white">inga danser ännu är inlösta</strong>. Vid delvis
            konsumtion, kontakta support för bedömning.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Specifikt för B2B-eventbokningar
          </h2>
          <p>
            Förfrågan utan godkännande kan dras tillbaka utan kostnad. Efter taxidansaren
            accepterat förfrågan och arrangören betalat, gäller standardpolicyn ovan: full
            återbetalning vid avbokning innan eventet är slutfört.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Tidslinje för återbetalning</h2>
          <p>
            Återbetalningar initieras direkt via Stripe när bokningen avbokas. Beloppet syns
            normalt på ditt kort inom <strong className="text-white">5–10 bankdagar</strong>{" "}
            beroende på bank och kortutgivare.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Tvister och support</h2>
          <p>
            Vid oenighet mellan kund och kreatör/arrangör, eller om en återbetalning inte
            kommit fram efter 10 bankdagar, mejla{" "}
            <a
              href="mailto:support@usha.se"
              className="text-[var(--usha-gold)] hover:underline"
            >
              support@usha.se
            </a>{" "}
            med boknings-ID och en kort beskrivning. Vi medlar och utreder.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Plattformsavgift</h2>
          <p>
            Vid återbetalning återbetalas hela beloppet till kunden. Den provision Usha tagit
            ut från kreatören återgår också, så ingen part bär kostnaden för en korrekt avbokning.
            Fall där bedrägeri eller missbruk misstänks utreds separat.
          </p>
        </section>
      </div>
    </div>
  );
}
