import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>

        <h1 className="mb-2 text-4xl font-bold">Integritetspolicy</h1>
        <p className="mb-12 text-sm text-[var(--usha-muted)]">
          Senast uppdaterad: 1 januari 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Personuppgiftsansvarig</h2>
            <p>
              Usha AB, org.nr 559XXX-XXXX, är personuppgiftsansvarig för behandlingen av dina
              personuppgifter. Vi behandlar dina uppgifter i enlighet med EU:s dataskyddsförordning
              (GDPR) och svensk lag.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Vilka uppgifter vi samlar in</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Kontouppgifter: namn, e-postadress, profilbild</li>
              <li>Betalningsuppgifter: hanteras av Stripe (vi lagrar inga kortuppgifter)</li>
              <li>Bokningshistorik: datum, tid, tjänster du bokat</li>
              <li>Kommunikation: meddelanden via plattformen</li>
              <li>Teknisk data: IP-adress, webbläsartyp, enhetsinformation</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. Hur vi använder uppgifterna</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Tillhandahålla och förbättra vår tjänst</li>
              <li>Hantera bokningar och betalningar</li>
              <li>Skicka bekräftelser och notifikationer</li>
              <li>Förhindra bedrägeri och missbruk</li>
              <li>Uppfylla rättsliga förpliktelser</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. Rättslig grund</h2>
            <p>
              Vi behandlar dina uppgifter baserat på: fullgörande av avtal (för att leverera
              tjänsten), berättigat intresse (för att förbättra plattformen), samtycke (för
              marknadsföring) och rättslig förpliktelse (bokföring).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. Delning av uppgifter</h2>
            <p>
              Vi delar dina uppgifter med: Stripe (betalningshantering), Supabase (datalagring),
              Resend (e-postutskick). Vi säljer aldrig dina personuppgifter till tredje part.
              Uppgifter kan delas med myndigheter om det krävs enligt lag.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">6. Lagringstid</h2>
            <p>
              Vi sparar dina uppgifter så länge ditt konto är aktivt. Efter kontoborttagning
              raderar vi dina personuppgifter inom 30 dagar, med undantag för uppgifter som
              vi enligt lag är skyldiga att spara (t.ex. bokföringsuppgifter i 7 år).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">7. Dina rättigheter</h2>
            <p>Enligt GDPR har du rätt att:</p>
            <ul className="list-disc space-y-2 pl-6 mt-2">
              <li>Begära tillgång till dina uppgifter</li>
              <li>Begära rättelse av felaktiga uppgifter</li>
              <li>Begära radering (&ldquo;rätten att bli glömd&rdquo;)</li>
              <li>Begränsa behandlingen av dina uppgifter</li>
              <li>Invända mot behandling</li>
              <li>Begära dataportabilitet</li>
              <li>Återkalla samtycke</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">8. Säkerhet</h2>
            <p>
              Vi vidtar lämpliga tekniska och organisatoriska åtgärder för att skydda dina
              uppgifter, inklusive kryptering vid överföring och lagring, åtkomstkontroll
              och regelbundna säkerhetsutvärderingar.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">9. Kontakt</h2>
            <p>
              För frågor om hur vi hanterar dina personuppgifter, kontakta oss på{" "}
              <a href="mailto:privacy@usha.se" className="text-[var(--usha-gold)] hover:underline">
                privacy@usha.se
              </a>
            </p>
            <p className="mt-2">
              Du har även rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY).
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
