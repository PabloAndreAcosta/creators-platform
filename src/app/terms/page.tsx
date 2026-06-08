import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>

        <h1 className="mb-2 text-4xl font-bold">Användarvillkor</h1>
        <p className="mb-12 text-sm text-[var(--usha-muted)]">
          Senast uppdaterad: 1 januari 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--usha-muted)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">1. Allmänt</h2>
            <p>
              Dessa användarvillkor (&ldquo;Villkor&rdquo;) reglerar din användning av Usch-Ja-plattformen
              (&ldquo;Plattformen&rdquo;) som tillhandahålls av Usha AB, med säte i
              Malmö, Sverige (&ldquo;Usch-Ja&rdquo;, &ldquo;vi&rdquo;, &ldquo;oss&rdquo;). Genom att skapa ett konto eller använda
              Plattformen godkänner du dessa Villkor.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">2. Tjänsten</h2>
            <p>
              Usch-Ja är en marknadsplats som kopplar samman kreatörer, upplevelseleverantörer
              och kunder. Plattformen gör det möjligt att publicera tjänster, boka upplevelser
              och genomföra betalningar. Usch-Ja agerar som förmedlare och är inte part i avtal
              mellan kreatörer och kunder.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">3. Konto</h2>
            <p>
              Du måste vara minst 18 år för att skapa ett konto. Du ansvarar för att hålla dina
              inloggningsuppgifter säkra. All aktivitet som sker under ditt konto är ditt ansvar.
              Usch-Ja förbehåller sig rätten att avsluta konton som bryter mot dessa Villkor.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">4. Betalningar</h2>
            <p>
              Betalningar hanteras genom Stripe. Genom att använda Plattformen godkänner du
              även Stripes tjänstevillkor. Usch-Ja tar en provision på transaktioner enligt den
              prisnivå som kreatören prenumererar på (Silver: 20%, Gold: 10%, Platinum: 5%).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">5. Avbokningar</h2>
            <p>
              Avbokningar kan göras av både kunder och kreatörer. Avbokningsvillkoren
              bestäms av kreatören för varje enskild tjänst. Usch-Ja ansvarar inte för
              eventuella tvister kring avbokningar.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">6. Upphovsrätt</h2>
            <p>
              Allt innehåll som du laddar upp till Plattformen förblir din egendom. Genom att
              publicera innehåll på Plattformen ger du Usch-Ja en icke-exklusiv rätt att visa
              och distribuera innehållet inom ramen för tjänsten.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">7. Ansvarsbegränsning</h2>
            <p>
              Usch-Ja tillhandahåller Plattformen &ldquo;som den är&rdquo; utan garantier av något slag.
              Vi ansvarar inte för indirekta skador, utebliven vinst eller förlust av data.
              Vårt totala ansvar är begränsat till det belopp du har betalat till Usch-Ja under
              de senaste 12 månaderna.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">8. Ändringar</h2>
            <p>
              Usch-Ja förbehåller sig rätten att ändra dessa Villkor. Väsentliga ändringar
              meddelas via e-post eller via Plattformen minst 30 dagar innan de träder i kraft.
              Fortsatt användning efter ändringar innebär att du godkänner de uppdaterade Villkoren.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">9. Tillämplig lag</h2>
            <p>
              Dessa Villkor regleras av svensk lag. Eventuella tvister ska i första hand lösas
              genom förhandling, i andra hand genom allmän domstol med Malmö tingsrätt som
              första instans.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--usha-white)]">10. Kontakt</h2>
            <p>
              Har du frågor om dessa Villkor? Kontakta oss på{" "}
              <a href="mailto:legal@usha.se" className="text-[var(--usha-gold)] hover:underline">
                legal@usha.se
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
