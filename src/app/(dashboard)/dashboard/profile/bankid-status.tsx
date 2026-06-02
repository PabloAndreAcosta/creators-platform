import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BankIdVerifyButton } from "./bankid-verify-button";

interface BankIdStatusProps {
  verifiedAt: string | null;
  bankidName: string | null;
  isCreatorRole: boolean;
  profileRole?: "creator" | "experience" | string | null;
}

export async function BankIdStatus({
  verifiedAt,
  bankidName,
  isCreatorRole,
  profileRole,
}: BankIdStatusProps) {
  const t = await getTranslations("dashProfile.bankid");
  const verifyRole: "creator" | "experience" =
    profileRole === "experience" ? "experience" : "creator";
  if (verifiedAt) {
    const date = new Date(verifiedAt);
    const formatted = date.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
            <ShieldCheck size={24} className="text-green-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-green-400">
              {t("verifiedTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">
              {bankidName ? (
                t.rich("verifiedAsNamed", {
                  name: bankidName,
                  date: formatted,
                  span: (chunks) => <span className="text-white">{chunks}</span>,
                })
              ) : (
                t("verifiedOn", { date: formatted })
              )}
            </p>
            <p className="mt-2 text-xs text-[var(--usha-muted)]">
              {t("verifiedBadgeNote")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stricter / blocking style for creator/experience accounts — BankID
  // is mandatory for them to appear publicly on the marketplace.
  if (isCreatorRole) {
    return (
      <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
            <ShieldAlert size={24} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-amber-400">
              {t("requiredTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">
              {t("requiredDesc")}
            </p>
            <BankIdVerifyButton
              role={verifyRole}
              label={t("verifyNow")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--usha-muted)]/10">
          <ShieldAlert size={24} className="text-[var(--usha-muted)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t("notVerifiedTitle")}</h2>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {t("notVerifiedDesc")}
          </p>
          <BankIdVerifyButton
            role={verifyRole}
            label={t("verify")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
