import Link from "next/link";
import { Music, ShieldCheck, Wallet, Calendar, GraduationCap, MapPin } from "lucide-react";

export const metadata = {
  title: "Taxidansare på Usha — boka eller bli en",
  description:
    "Hitta professionella taxidansare för pardans (bugg, foxtrot, salsa, tango) eller bli betald danspartner via Usha. BankID-verifierade dansare, säker betalning, paket och privatlektioner.",
};

export default function TaxiDancerLandingPage() {
  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--usha-border)]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <Music size={28} className="text-[var(--usha-gold)]" />
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Taxidansare. <span className="text-gradient">Boka eller bli en.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--usha-muted)] sm:text-lg">
            Pardans på dina villkor — bugg, foxtrot, salsa, tango, lindy hop. Hitta
            BankID-verifierade taxidansare för en kväll, ett event, eller privatlektioner.
            Eller bli en själv och få betalt direkt via plattformen.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app/search?subcategory=taxi_dancer"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              Hitta taxidansare
            </Link>
            <Link
              href="/signup"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-8 py-3 text-sm font-medium text-white transition hover:border-[var(--usha-gold)]/40"
            >
              Bli taxidansare
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--usha-muted)]">
            Som taxidansare behöver du verifiera dig med Mobilt BankID. Åldersgräns 18 år.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Varför Usha för taxidans?
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <ValueCard
            icon={<Wallet size={24} className="text-[var(--usha-gold)]" />}
            title="Få betalt direkt"
            description="Pengarna landar på ditt konto via Stripe Connect efter varje bokning. Sänkt provision för taxidansare — 8 % på gratis-tier (mot 15 % standard), 5 % på Guld."
          />
          <ValueCard
            icon={<ShieldCheck size={24} className="text-[var(--usha-gold)]" />}
            title="BankID-verifierat"
            description="Alla taxidansare bekräftar identitet och ålder med Mobilt BankID. Bygger förtroende mellan kund, arrangör och dansare."
          />
          <ValueCard
            icon={<GraduationCap size={24} className="text-[var(--usha-gold)]" />}
            title="Paket + coachning"
            description="Sälj förbetalda danspaket som inlöses successivt på event, eller erbjud privatlektioner med kalenderbokning. Båda flödena ingår."
          />
        </div>
      </section>

      {/* Two paths */}
      <section className="border-t border-[var(--usha-border)] bg-[var(--usha-card)]/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Hur det fungerar</h2>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--usha-gold)]">
                För kunder
              </div>
              <h3 className="text-xl font-bold">Boka en taxidansare</h3>
              <ol className="mt-4 space-y-3 text-sm text-[var(--usha-muted)]">
                <li>
                  <span className="font-semibold text-white">1.</span> Sök upp en taxidansare via
                  filtret eller länken ovan.
                </li>
                <li>
                  <span className="font-semibold text-white">2.</span> Välj <em>danspaket</em>{" "}
                  (förbetalt, inlöses på event) eller <em>coachning</em> (specifik tid).
                </li>
                <li>
                  <span className="font-semibold text-white">3.</span> Betala säkert via Stripe.
                </li>
                <li>
                  <span className="font-semibold text-white">4.</span> Träffas på dansgolvet eller
                  studion. Dansaren markerar varje dans inlöst i appen.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--usha-accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--usha-accent)]">
                För arrangörer
              </div>
              <h3 className="text-xl font-bold">Boka för event</h3>
              <ol className="mt-4 space-y-3 text-sm text-[var(--usha-muted)]">
                <li>
                  <span className="font-semibold text-white">1.</span> Skicka eventförfrågan från
                  taxidansarens profil — datum, tid, lokal, ersättning.
                </li>
                <li>
                  <span className="font-semibold text-white">2.</span> Lägg till förmåner (entré,
                  drinkar, hotell) som gör erbjudandet attraktivt.
                </li>
                <li>
                  <span className="font-semibold text-white">3.</span> Taxidansaren accepterar
                  eller avböjer inom kort.
                </li>
                <li>
                  <span className="font-semibold text-white">4.</span> Betala via plattformen när
                  förfrågan accepterats. Pengarna går direkt till dansaren.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* For dancers */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Är du erfaren danspartner?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[var(--usha-muted)]">
          Skapa en profil, beskriv dina stilar, sätt dina priser. Bjud även på
          privatlektioner om du vill — många taxidansare på Usha gör båda.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <FeatureRow
            icon={<Calendar size={18} />}
            title="Egen kalender"
            description="Bestäm själv när du är tillgänglig för bokningar."
          />
          <FeatureRow
            icon={<MapPin size={18} />}
            title="Egen QR-kod"
            description="Dela din profil på affischer, visitkort, eller digitalt."
          />
          <FeatureRow
            icon={<Wallet size={18} />}
            title="Sänkt provision"
            description="8 % på gratis-tier, 5 % på Guld, 3 % på Premium."
          />
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90"
          >
            Skapa taxidansar-profil
          </Link>
        </div>
      </section>

      {/* Positioning */}
      <section className="border-t border-[var(--usha-border)] bg-[var(--usha-card)]/30">
        <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-[var(--usha-muted)]">
          <h2 className="mb-3 text-base font-semibold text-white">Vad taxidans är — och inte är</h2>
          <p>
            En taxidansare är en betald danspartner för pardans (bugg, foxtrot, salsa, tango,
            lindy hop m.fl.) på offentliga eller privata danstillfällen, eller en
            instruktör som ger privatlektioner. Tjänsten omfattar inte sexuell eller intim
            kontakt. Användning utanför detta bryter mot Ushas användarvillkor och leder till
            avstängning.
          </p>
          <p className="mt-3">
            Läs mer:{" "}
            <Link href="/refund-policy" className="text-[var(--usha-gold)] hover:underline">
              Återbetalningspolicy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="text-[var(--usha-gold)] hover:underline">
              Användarvillkor
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function ValueCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--usha-muted)]">{description}</p>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
      <div className="mb-2 flex items-center gap-2 text-[var(--usha-gold)]">
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-[var(--usha-muted)]">{description}</p>
    </div>
  );
}
