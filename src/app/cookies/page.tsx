import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CookiesPage() {
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

        <h1 className="mb-2 text-4xl font-bold">Cookiepolicy</h1>
        <p className="mb-12 text-sm text-[var(--usha-muted)]">
          Senast uppdaterad: 1 januari 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Vad är cookies?</h2>
            <p>
              Cookies är små textfiler som lagras på din enhet när du besöker en webbplats.
              De används för att webbplatsen ska fungera korrekt, komma ihåg dina inställningar
              och förbättra din upplevelse.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Vilka cookies vi använder</h2>

            <h3 className="mt-4 mb-2 font-semibold text-white">Nödvändiga cookies</h3>
            <p>
              Dessa cookies är nödvändiga för att Plattformen ska fungera. De hanterar
              autentisering, sessionshantering och säkerhet. Dessa cookies kan inte stängas av.
            </p>
            <ul className="list-disc space-y-1 pl-6 mt-2">
              <li>Supabase autentiseringscookies (inloggning, session)</li>
              <li>CSRF-skydd</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold text-white">Funktionella cookies</h3>
            <p>
              Dessa cookies gör det möjligt att komma ihåg dina val, som språk och
              roll-inställningar.
            </p>

            <h3 className="mt-4 mb-2 font-semibold text-white">Analyscookies</h3>
            <p>
              Vi kan använda analyscookies för att förstå hur besökare använder Plattformen.
              Dessa cookies samlar in anonym data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. Tredjepartscookies</h2>
            <p>
              Stripe kan placera cookies för att hantera betalningar säkert. Dessa cookies
              regleras av Stripes egna integritetspolicy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. Hantera cookies</h2>
            <p>
              Du kan hantera och radera cookies via din webbläsares inställningar. Observera
              att om du blockerar nödvändiga cookies kan delar av Plattformen sluta fungera.
            </p>
            <p className="mt-2">
              De flesta webbläsare tillåter dig att:
            </p>
            <ul className="list-disc space-y-1 pl-6 mt-2">
              <li>Se vilka cookies som är lagrade</li>
              <li>Radera enskilda eller alla cookies</li>
              <li>Blockera cookies från specifika webbplatser</li>
              <li>Blockera alla cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. Kontakt</h2>
            <p>
              Har du frågor om hur vi använder cookies? Kontakta oss på{" "}
              <a href="mailto:privacy@usha.se" className="text-[var(--usha-gold)] hover:underline">
                privacy@usha.se
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
