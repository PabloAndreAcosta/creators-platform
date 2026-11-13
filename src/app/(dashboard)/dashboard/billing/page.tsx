import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { commissionLabel } from "@/lib/stripe/commission";

export const dynamic = "force-dynamic";

/**
 * Förr prislistan med Guld och Premium, prenumerationsstatus och en
 * break-even-kalkylator. Sedan 2026-11-13 finns en nivå: gratis, allt ingår,
 * provision när man säljer (3,5 % + 3,50 kr per biljett sedan samma dag). Sidan ligger kvar på sin adress eftersom
 * länkar och gamla mejl pekar hit, men den säger nu bara vad som gäller och
 * visar vägen till utbetalningarna.
 *
 * Gamla prenumerationsrader finns kvar i databasen för historiken; ingen av
 * dem var betald, så det finns inget att säga upp.
 */
export default async function BillingPage() {
  const t = await getTranslations("billing");
  const tc = await getTranslations("common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isSeller = profile?.role === "creator" || profile?.role === "venue";
  const commission = commissionLabel();

  const included = [t("oneLevelItem1"), t("oneLevelItem2"), t("oneLevelItem3"), t("oneLevelItem4")];

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {tc("back")}
        </Link>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-[var(--usha-muted)]">{t("oneLevelSubtitle")}</p>
      </div>

      <div className="rounded-2xl border border-[var(--usha-gold)]/40 bg-[var(--usha-card)] p-8">
        <h2 className="text-xl font-bold">{t("oneLevelTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--usha-muted)]">
          {isSeller ? t("oneLevelBodySeller", { commission }) : t("oneLevelBodyBuyer")}
        </p>
        <ul className="mt-6 space-y-3">
          {included.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check size={14} className="mt-0.5 shrink-0 text-[var(--usha-gold)]" />
              <span className="text-[var(--usha-muted)]">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Utbetalningarna bor på sin egen sida; pekaren står kvar här eftersom
          det är här folk letat efter dem. */}
      {isSeller && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold">{t("payouts")}</h2>
          <Link
            href="/dashboard/payouts"
            className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition hover:border-[var(--usha-gold)]/40"
          >
            <span className="text-sm text-[var(--usha-muted)]">{t("payoutsMovedHint")}</span>
            <ArrowRight size={18} className="flex-shrink-0 text-[var(--usha-gold)]" />
          </Link>
        </div>
      )}
    </>
  );
}
