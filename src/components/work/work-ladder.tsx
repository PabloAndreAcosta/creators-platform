import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeartHandshake, GraduationCap, Briefcase } from "lucide-react";
import { COMMISSION_RATES } from "@/lib/stripe/commission";

/**
 * "Jobba med Usha" — de tre vägarna in, som en trappa.
 *
 * 1. Volontärpass: öppet för alla med Mobilt BankID och 18 år. Inga pengar
 *    nämns (fri entré + matkupong) — pengar nämns bara där någon får betalt.
 * 2. Instruktörsminuter: betalt, men kräver eget bolag och betalnivå i dag.
 * 3. Uppdrag: betalt; med eget bolag i dag, lön via Usha för den utan bolag
 *    först när lönevägen är i drift ("kommer snart").
 *
 * Kraven står öppet — ingen ska lockas till ett steg de inte kan ta.
 * Provisionen läses ur COMMISSION_RATES så att sidan och kassan säger samma sak.
 */
export async function WorkLadder({ loggedIn }: { loggedIn: boolean }) {
  const t = await getTranslations("work");
  const pct = (r: number) => Math.round(r * 100);
  const signup = (next: string, role: "customer" | "creator") =>
    `/signup?role=${role}&next=${encodeURIComponent(next)}`;

  const steps = [
    {
      n: 1,
      icon: HeartHandshake,
      key: "volunteer",
      body: t("volunteerBody"),
      requirements: t("volunteerReq"),
      cta: t("volunteerCta"),
      href: loggedIn ? "/app/taxi" : "/taxi",
    },
    {
      n: 2,
      icon: GraduationCap,
      key: "instructor",
      body: t("instructorBody", {
        free: pct(COMMISSION_RATES.gratis),
        gold: pct(COMMISSION_RATES.guld),
        premium: pct(COMMISSION_RATES.premium),
      }),
      requirements: t("instructorReq"),
      cta: t("instructorCta"),
      href: loggedIn ? "/app/events/open" : signup("/app/events/open", "creator"),
    },
    {
      n: 3,
      icon: Briefcase,
      key: "assignments",
      body: t("assignmentsBody"),
      requirements: t("assignmentsReq"),
      cta: t("assignmentsCta"),
      href: loggedIn ? "/app/gigs" : signup("/app/gigs", "creator"),
    },
  ] as const;

  return (
    <ol className="space-y-4">
      {steps.map((s) => (
        <li key={s.key} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10">
              <s.icon size={22} className="text-[var(--usha-gold)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--usha-gold)]">{t("step", { n: s.n })}</p>
              <h2 className="mt-0.5 text-lg font-bold">{t(`${s.key}Title`)}</h2>
              <p className="mt-2 text-sm text-[var(--usha-muted)]">{s.body}</p>
              <p className="mt-2 text-xs text-[var(--usha-muted)]">
                <span className="font-semibold text-[var(--usha-white)]">{t("requirementsLabel")}</span> {s.requirements}
              </p>
              <Link
                href={s.href}
                className="mt-4 inline-flex items-center rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
              >
                {s.cta}
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
