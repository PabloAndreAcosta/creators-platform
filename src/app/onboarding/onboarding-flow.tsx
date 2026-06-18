"use client";

import { useMemo, useState } from "react";
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

const TRACK_LABEL: Record<Track, string> = {
  C1: "C1 · Egenföretagare",
  C2: "C2 · Egenanställd",
  C3: "C3 · Volontär",
  C4: "C4 · Ideell förening",
  V1: "V1 · Företag",
  V2: "V2 · Förening / kulturhus",
  V3: "V3 · Offentlig aktör",
};

const TRACK_DESC: Record<Track, string> = {
  C1: "Du fakturerar i eget namn via Stripe. Usha tar bara provision och momsar bara den. Ansvaret är ditt.",
  C2: "Du får lön per uppdrag via EOR-partnern. De är arbetsgivare och drar skatt och avgifter. Pengarna går aldrig via Usha.",
  C3: "Du registreras som volontär. Endast utlägg mot kvitto kan betalas ut – aldrig ersättning.",
  C4: "Föreningen fakturerar som säljare. Usha tar provision. Ansvaret är föreningens.",
  V1: "Venue registrerad som B2B-köpare. Betalning via Stripe. Kan vara uppdragsgivare.",
  V2: "Förening/kulturhus (ej momsreg.). Kreatören säljer i “annans namn” så moms tas på provisionen, inte hela gaget.",
  V3: "Offentlig aktör. B2B-faktura med PO/referens. Beakta upphandlingsregler och ramavtal.",
};

export function OnboardingFlow({ isLoggedIn }: { isLoggedIn: boolean }) {
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
  const identifierLabel = identifierKey === "bank_account" ? "Bankkonto (clearing + nr)" : "Organisationsnummer";

  return (
    <div className="mx-auto flex min-h-[560px] max-w-sm flex-col rounded-3xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--usha-muted)]">
        <span className="font-bold text-[var(--usha-white)]">Usha Platform</span>
        <span className="rounded-full bg-[var(--usha-black)] px-2.5 py-1">Onboarding · demo</span>
      </div>

      {step !== "S0_BANKID" && step !== "DONE" && (
        <button onClick={goBack} className="mb-2 self-start text-xs text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
          ← Tillbaka
        </button>
      )}

      <div className="flex flex-1 flex-col">
        {/* S0 BankID — hard first gate (G1) */}
        {step === "S0_BANKID" && (
          <Screen title="Välkommen" sub="Alla användare verifieras med BankID. Det är vår grund för trygghet.">
            <Field label="BankID">Namn, personnummer och kontaktuppgifter hämtas säkert.</Field>
            {!isLoggedIn && (
              <Note tone="muted">Demo – logga in på usha.se för att spara din onboarding.</Note>
            )}
            {error && <Note tone="warn">{error}</Note>}
            <Spacer />
            <Primary onClick={handleBankId} disabled={bankIdLoading}>
              {bankIdLoading ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Logga in med BankID (mock)"}
            </Primary>
          </Screen>
        )}

        {/* S1 role */}
        {step === "S1_ROLE" && (
          <Screen title="Vad vill du göra?" sub="Du kan välja båda senare.">
            <Choice title="Jag är kreatör" desc="DJ, artist, workshopledare, fotograf …" onClick={() => set({ role: "creator" })} />
            <Choice title="Jag erbjuder en lokal (venue)" desc="Café, kulturhus, spa, eventlokal …" onClick={() => set({ role: "venue" })} />
          </Screen>
        )}

        {/* K1 */}
        {step === "K1_COMPANY" && (
          <Screen title="Har du eget företag med F-skatt?" sub="Det avgör hur du får betalt och vem som sköter skatten.">
            <Choice title="Ja, jag har företag (AB / enskild firma)" desc="Du fakturerar själv" onClick={() => set({ company: "company" })} />
            <Choice title="Nej, jag har inget företag" desc="Vi löser betalningen åt dig" onClick={() => set({ company: "none" })} />
            <Choice title="Jag representerar en ideell förening" desc="Föreningen fakturerar" onClick={() => set({ company: "nonprofit" })} />
          </Screen>
        )}

        {/* K2 */}
        {step === "K2_PAYMENT" && (
          <Screen title="Hur vill du få betalt?" sub="Utan eget företag finns två vägar.">
            <Choice title="Som lön" desc="Vi (via partner) sköter skatt, avgifter och försäkring" onClick={() => set({ payment: "salary" })} />
            <Choice title="Jag är volontär" desc="Ingen ersättning eller förmån – bara utlägg" onClick={() => set({ payment: "volunteer" })} />
          </Screen>
        )}

        {/* Track forms C1–C4 + venue form */}
        {["C1_FORM", "C2_FORM", "C3_FORM", "C4_FORM", "V_FORM"].includes(step) && track && (
          <Screen title={`Spår ${TRACK_LABEL[track]}`} sub={track === "C3" ? undefined : undefined}>
            {track === "C3" && (
              <p className="mb-2 text-[13px] leading-relaxed text-[var(--usha-muted)]">
                Volontär = du hjälper till utan betalning. Du kan bara få ersättning för utlägg mot kvitto.
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
                  placeholder={identifierKey === "org_no" ? "ex. 5560000000" : "ex. 8327-9 1234567"}
                  className="mt-1 w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2.5 text-sm text-[var(--usha-white)] outline-none focus:border-[var(--usha-gold)]/60"
                />
              </label>
            )}

            {fieldsForTrack(track)
              .filter((f) => f.key !== identifierKey)
              .map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                  {f.key === "fskatt_status" ? "Hämtas automatiskt från Skatteverket (mock)" : "samlas in"}
                </Field>
              ))}

            {track === "C3" && (
              <Note tone="warn">
                Får du betalt eller någon förmån – gage, gåvor, produkter, fri entré – är du inte volontär. Välj då lön (C2)
                eller eget företag (C1).
              </Note>
            )}
            <Note tone="info">{TRACK_DESC[track]}</Note>
            {error && <Note tone="warn">{error}</Note>}
            <Spacer />
            <Primary onClick={handleFinish} disabled={saving}>
              {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Slutför"}
            </Primary>
          </Screen>
        )}

        {/* V1 type */}
        {step === "V1_TYPE" && (
          <Screen title="Vilken typ av aktör är ni?">
            <Choice title="Företag" desc="Momsregistrerat (café, spa, eventbolag)" onClick={() => set({ venueType: "company" })} />
            <Choice title="Förening / kulturhus" desc="Ej momsregistrerat" onClick={() => set({ venueType: "association" })} />
            <Choice title="Offentlig aktör" desc="Kommun, kulturförvaltning" onClick={() => set({ venueType: "public" })} />
          </Screen>
        )}

        {/* Done */}
        {step === "DONE" && (
          <Screen title="Klart! ✓" sub="Du är BankID-verifierad och redo.">
            {track && (
              <>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} className="text-[var(--usha-gold)]" /> Spår: {TRACK_LABEL[track]}
                </div>
                <Note tone="info">{TRACK_DESC[track]}</Note>
              </>
            )}
            <Note tone={persisted ? "info" : "muted"}>
              {persisted
                ? "Sparat i ditt konto ✓"
                : "Demo – logga in på usha.se för att spara din onboarding."}
            </Note>
            <Note tone="muted">Kvartalsvis ersättning loggas automatiskt för DAC7-rapportering.</Note>
            <Spacer />
            <Outline onClick={() => setOverrideStep("ESCROW_INFO")}>Se hur utbetalningen fungerar</Outline>
            <Ghost onClick={reset}>Börja om</Ghost>
          </Screen>
        )}

        {/* Escrow explanation */}
        {step === "ESCROW_INFO" && (
          <Screen title="Så går pengarna">
            <ol className="space-y-2.5 text-[13px] text-[var(--usha-white)]">
              <li>Venue betalar in via <b className="text-[var(--usha-gold)]">Stripe</b> – aldrig till Ushas konto.</li>
              <li>Pengarna <b className="text-[var(--usha-gold)]">hålls säkert</b> hos PSP/EOR tills uppdraget markeras genomfört.</li>
              <li>Skatt, avgifter och Ushas provision dras automatiskt.</li>
              <li>Resten betalas ut till <b className="text-[var(--usha-gold)]">dig / din partner</b>.</li>
            </ol>
            <Note tone="info">Usha bokför bara provisionen. Bruttosumman passerar aldrig bolagskontot.</Note>
            <Spacer />
            <Ghost onClick={() => setOverrideStep("DONE")}>Klar</Ghost>
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
