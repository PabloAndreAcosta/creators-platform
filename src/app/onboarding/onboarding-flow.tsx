"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  currentStep,
  previousStep,
  resolveTrack,
  fieldsForTrack,
  type OnboardingAnswers,
  type Step,
} from "@/lib/onboarding/router";
import type { Track } from "@/lib/onboarding/types";
import { verifyBankId, completeOnboarding, type OnboardingFields } from "./actions";

const TRACK_LABEL_KEY: Record<Track, string> = {
  C1: "trackLabel.C1",
  C2: "trackLabel.C2",
  C3: "trackLabel.C3",
  C4: "trackLabel.C4",
  V1: "trackLabel.V1",
  V2: "trackLabel.V2",
  V3: "trackLabel.V3",
};

const TRACK_DESC_KEY: Record<Track, string> = {
  C1: "trackDesc.C1",
  C2: "trackDesc.C2",
  C3: "trackDesc.C3",
  C4: "trackDesc.C4",
  V1: "trackDesc.V1",
  V2: "trackDesc.V2",
  V3: "trackDesc.V3",
};

export function OnboardingFlow({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations("signupOnboarding");
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [overrideStep, setOverrideStep] = useState<Step | null>(null);
  const [bankIdLoading, setBankIdLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<OnboardingFields>({});

  const computed = currentStep(answers);
  const step: Step = overrideStep ?? computed;
  const track = useMemo(() => resolveTrack(answers), [answers]);

  function set(patch: Partial<OnboardingAnswers>) {
    setOverrideStep(null);
    setError(null);
    setAnswers((a) => ({ ...a, ...patch }));
  }
  function goBack() {
    const prev = previousStep(step, answers);
    if (prev) setOverrideStep(prev);
  }
  function reset() {
    setAnswers({});
    setOverrideStep(null);
    setFields({});
    setPersisted(false);
    setError(null);
  }

  async function handleBankId() {
    setError(null);
    if (!isLoggedIn) {
      set({ bankIdVerified: true }); // demo — not persisted
      return;
    }
    setBankIdLoading(true);
    const res = await verifyBankId();
    setBankIdLoading(false);
    if (res.ok) set({ bankIdVerified: true });
    else setError(res.error);
  }

  async function handleFinish() {
    setError(null);
    if (!track) return;
    if (!isLoggedIn) {
      setOverrideStep("DONE"); // demo — not persisted
      return;
    }
    setSaving(true);
    const res = await completeOnboarding({ track, fields });
    setSaving(false);
    if (res.ok) {
      setPersisted(true);
      setOverrideStep("DONE");
    } else {
      setError(res.error);
    }
  }

  /** The one identifier we collect per track (kept minimal for this version). */
  const identifierKey: keyof OnboardingFields | null = track
    ? track === "C2" || track === "C3"
      ? "bank_account"
      : "org_no"
    : null;
  const identifierLabel =
    identifierKey === "bank_account" ? t("identifier.bankAccount") : t("identifier.orgNo");

  return (
    <div className="mx-auto flex min-h-[560px] max-w-sm flex-col rounded-3xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--usha-muted)]">
        <span className="font-bold text-[var(--usha-white)]">{t("appName")}</span>
        <span className="rounded-full bg-[var(--usha-black)] px-2.5 py-1">{t("badgeDemo")}</span>
      </div>

      {step !== "S0_BANKID" && step !== "DONE" && (
        <button onClick={goBack} className="mb-2 self-start text-xs text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
          {t("back")}
        </button>
      )}

      <div className="flex flex-1 flex-col">
        {/* S0 BankID — hard first gate (G1) */}
        {step === "S0_BANKID" && (
          <Screen title={t("s0.title")} sub={t("s0.sub")}>
            <Field label={t("s0.fieldLabel")}>{t("s0.fieldBody")}</Field>
            {!isLoggedIn && (
              <Note tone="muted">{t("demoNotice")}</Note>
            )}
            {error && <Note tone="warn">{error}</Note>}
            <Spacer />
            <Primary onClick={handleBankId} disabled={bankIdLoading}>
              {bankIdLoading ? <Loader2 size={16} className="mx-auto animate-spin" /> : t("s0.loginBankId")}
            </Primary>
          </Screen>
        )}

        {/* S1 role */}
        {step === "S1_ROLE" && (
          <Screen title={t("s1.title")} sub={t("s1.sub")}>
            <Choice title={t("s1.creatorTitle")} desc={t("s1.creatorDesc")} onClick={() => set({ role: "creator" })} />
            <Choice title={t("s1.venueTitle")} desc={t("s1.venueDesc")} onClick={() => set({ role: "venue" })} />
          </Screen>
        )}

        {/* K1 */}
        {step === "K1_COMPANY" && (
          <Screen title={t("k1.title")} sub={t("k1.sub")}>
            <Choice title={t("k1.companyTitle")} desc={t("k1.companyDesc")} onClick={() => set({ company: "company" })} />
            <Choice title={t("k1.noneTitle")} desc={t("k1.noneDesc")} onClick={() => set({ company: "none" })} />
            <Choice title={t("k1.nonprofitTitle")} desc={t("k1.nonprofitDesc")} onClick={() => set({ company: "nonprofit" })} />
          </Screen>
        )}

        {/* K2 */}
        {step === "K2_PAYMENT" && (
          <Screen title={t("k2.title")} sub={t("k2.sub")}>
            <Choice title={t("k2.salaryTitle")} desc={t("k2.salaryDesc")} onClick={() => set({ payment: "salary" })} />
            <Choice title={t("k2.volunteerTitle")} desc={t("k2.volunteerDesc")} onClick={() => set({ payment: "volunteer" })} />
          </Screen>
        )}

        {/* Track forms C1–C4 + venue form */}
        {["C1_FORM", "C2_FORM", "C3_FORM", "C4_FORM", "V_FORM"].includes(step) && track && (
          <Screen title={t("form.trackHeading", { track: t(TRACK_LABEL_KEY[track]) })} sub={undefined}>
            {track === "C3" && (
              <p className="mb-2 text-[13px] leading-relaxed text-[var(--usha-muted)]">
                {t("form.c3Intro")}
              </p>
            )}

            {/* One real input is collected and saved; the rest are shown as the
                fields that will be collected (per §4). */}
            {identifierKey && (
              <label className="mt-2.5 block">
                <span className="text-[13px] font-semibold">{identifierLabel} *</span>
                <input
                  value={fields[identifierKey] ?? ""}
                  onChange={(e) => setFields((f) => ({ ...f, [identifierKey]: e.target.value }))}
                  placeholder={identifierKey === "org_no" ? t("identifier.orgNoPlaceholder") : t("identifier.bankAccountPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-sm text-[var(--usha-white)] outline-none focus:border-[var(--usha-gold)]/60"
                />
              </label>
            )}

            {fieldsForTrack(track)
              .filter((f) => f.key !== identifierKey)
              .map((f) => (
                <Field key={f.key} label={`${t(`field.${f.key}`)}${f.required ? " *" : ""}`}>
                  {f.key === "fskatt_status" ? t("form.fskattAuto") : t("form.collected")}
                </Field>
              ))}

            {track === "C3" && (
              <Note tone="warn">
                {t("form.c3Warn")}
              </Note>
            )}
            <Note tone="info">{t(TRACK_DESC_KEY[track])}</Note>
            {error && <Note tone="warn">{error}</Note>}
            <Spacer />
            <Primary onClick={handleFinish} disabled={saving}>
              {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : t("form.finish")}
            </Primary>
          </Screen>
        )}

        {/* V1 type */}
        {step === "V1_TYPE" && (
          <Screen title={t("v1.title")}>
            <Choice title={t("v1.companyTitle")} desc={t("v1.companyDesc")} onClick={() => set({ venueType: "company" })} />
            <Choice title={t("v1.associationTitle")} desc={t("v1.associationDesc")} onClick={() => set({ venueType: "association" })} />
            <Choice title={t("v1.publicTitle")} desc={t("v1.publicDesc")} onClick={() => set({ venueType: "public" })} />
          </Screen>
        )}

        {/* Done */}
        {step === "DONE" && (
          <Screen title={t("done.title")} sub={t("done.sub")}>
            {track && (
              <>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} className="text-[var(--usha-gold)]" /> {t("done.trackPrefix", { track: t(TRACK_LABEL_KEY[track]) })}
                </div>
                <Note tone="info">{t(TRACK_DESC_KEY[track])}</Note>
              </>
            )}
            <Note tone={persisted ? "info" : "muted"}>
              {persisted ? t("done.saved") : t("demoNotice")}
            </Note>
            <Note tone="muted">{t("done.dac7")}</Note>
            <Spacer />
            <Outline onClick={() => setOverrideStep("ESCROW_INFO")}>{t("done.seePayout")}</Outline>
            <Ghost onClick={reset}>{t("done.restart")}</Ghost>
          </Screen>
        )}

        {/* Escrow explanation */}
        {step === "ESCROW_INFO" && (
          <Screen title={t("escrow.title")}>
            <ol className="space-y-2.5 text-[13px] text-[var(--usha-white)]">
              <li>{t.rich("escrow.step1", { b: (chunks) => <b className="text-[var(--usha-gold)]">{chunks}</b> })}</li>
              <li>{t.rich("escrow.step2", { b: (chunks) => <b className="text-[var(--usha-gold)]">{chunks}</b> })}</li>
              <li>{t("escrow.step3")}</li>
              <li>{t.rich("escrow.step4", { b: (chunks) => <b className="text-[var(--usha-gold)]">{chunks}</b> })}</li>
            </ol>
            <Note tone="info">{t("escrow.note")}</Note>
            <Spacer />
            <Ghost onClick={() => setOverrideStep("DONE")}>{t("escrow.done")}</Ghost>
          </Screen>
        )}
      </div>
    </div>
  );
}

/* ── small presentational helpers ───────────────────────────────────────────── */

function Screen({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-lg font-bold">{title}</h1>
      {sub && <p className="mb-3 mt-1 text-[13px] leading-relaxed text-[var(--usha-muted)]">{sub}</p>}
      {children}
    </div>
  );
}
function Spacer() {
  return <div className="flex-1" />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 rounded-xl border border-dashed border-[var(--usha-border)] p-3">
      <div className="text-[13px] font-semibold">{label}</div>
      <div className="text-xs text-[var(--usha-muted)]">{children}</div>
    </div>
  );
}
function Choice({ title, desc, onClick }: { title: string; desc?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2.5 w-full rounded-2xl border border-[var(--usha-border)] p-3.5 text-left transition hover:border-[var(--usha-gold)]/60 hover:bg-[var(--usha-gold)]/5"
    >
      <span className="block text-sm font-semibold">{title}</span>
      {desc && <span className="block text-xs text-[var(--usha-muted)]">{desc}</span>}
    </button>
  );
}
function Note({ tone, children }: { tone: "info" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "bg-[var(--usha-accent)]/10 text-[var(--usha-accent)]"
      : tone === "muted"
        ? "bg-[var(--usha-black)] text-[var(--usha-muted)]"
        : "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]";
  return <div className={`mt-3 rounded-xl p-3 text-xs leading-relaxed ${cls}`}>{children}</div>;
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function Outline({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2.5 w-full rounded-xl border border-[var(--usha-gold)] py-3 text-sm font-semibold text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/10">
      {children}
    </button>
  );
}
function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2.5 w-full rounded-xl bg-[var(--usha-black)] py-3 text-sm font-medium text-[var(--usha-white)] transition hover:opacity-90">
      {children}
    </button>
  );
}
