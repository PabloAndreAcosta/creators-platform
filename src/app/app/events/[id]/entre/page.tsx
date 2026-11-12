"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, CheckCircle2, RefreshCw, Link2, Check, ScanLine, Lock, Smartphone, HeartPulse } from "lucide-react";

/**
 * Entréförsäljning utan kortläsare.
 *
 * Värden väljer biljett och visar QR-koden; gästen scannar med sin egen
 * telefon och betalar med Apple Pay eller Google Pay. Gästens telefon är
 * terminalen, och köpet går genom samma kassa som en onlineförsäljning — så
 * pengarna landar i Stripe och avräkningen stämmer utan efterarbete.
 *
 * Skärmen pollar efter betalningar medan koden visas. Utan den bekräftelsen
 * står värden och väntar på att gästen ska leta fram sitt kvittomejl innan hen
 * kan släppas in, och då är hela poängen med snabbheten borta.
 */

interface TicketType {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  tickets_sold: number;
}

interface Sale {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  amount_paid: number | null;
  guest_count: number | null;
  ticket_type_name: string | null;
  created_at: string;
  payment_method?: string | null;
}

interface PendingSwish {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  amount_paid: number | null;
  guest_count: number | null;
  ticket_type_name: string | null;
  created_at: string;
}

const POLL_MS = 5000;

export default function EntrancePage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("entrance");

  const [title, setTitle] = useState("");
  const [types, setTypes] = useState<TicketType[]>([]);
  const [selected, setSelected] = useState<TicketType | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  // Efterköpsläget kommer från servern. Entréenhetens egen klocka får inte
  // avgöra om fönstret är öppet — se entry-rutten.
  // Länkknappen: "idle" → "hamtar" → "kopierad" (eller ett fel).
  const [lank, setLank] = useState<"idle" | "hamtar" | "kopierad" | "fel">("idle");
  const [efterkop, setEfterkop] = useState<{ oppet: boolean; stangerVid: string | null; stangt: boolean }>({
    oppet: false,
    stangerVid: null,
    stangt: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Kioskläget är Premium; servern avgör utifrån värdens nivå.
  const [kiosk, setKiosk] = useState<{ allowed: boolean; premium: boolean; beta: boolean } | null>(null);
  // Swish Företag: visas bara för Ushas egna evenemang (servern avgör).
  const [swish, setSwish] = useState<{ enabled: boolean; number?: string; formatted?: string }>({ enabled: false });
  const [swishOpen, setSwishOpen] = useState(false);
  const [swishName, setSwishName] = useState("");
  const [swishEmail, setSwishEmail] = useState("");
  const [swishCount, setSwishCount] = useState(1);
  const [swishState, setSwishState] = useState<"idle" | "sparar" | "klar" | "fel">("idle");
  // Vilande Swish-köp från eventsidan ("Jag har swishat"), att jämföra mot
  // Swish-appen och avgöra. Raden med pågående anrop får inte tryckas igen.
  const [pendingSwish, setPendingSwish] = useState<PendingSwish[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingCheckIn, setPendingCheckIn] = useState(true);
  // Epassi i dörren: en enstaka kväll köpt i Epassi-appen (friskvårdskvällar).
  const [epassi, setEpassi] = useState<{ enabled: boolean }>({ enabled: false });
  const [epassiOpen, setEpassiOpen] = useState(false);
  const [epassiName, setEpassiName] = useState("");
  const [epassiCount, setEpassiCount] = useState(1);
  const [epassiState, setEpassiState] = useState<"idle" | "sparar" | "klar" | "fel">("idle");

  // Tidsstämpeln kommer från servern, inte från telefonen. En entrémobil med
  // några minuters klockfel hade annars antingen missat betalningar eller
  // visat gamla som nya.
  const since = useRef<string | null>(null);

  const load = useCallback(
    async (poll: boolean) => {
      try {
        const qs = poll && since.current ? `?since=${encodeURIComponent(since.current)}` : "";
        const res = await fetch(`/api/events/${id}/entry${qs}`);
        if (!res.ok) {
          setError(res.status === 403 ? t("noPermission") : t("loadError"));
          return;
        }
        const data = await res.json();
        setError(null);
        setTitle(data.listing.title);
        setTypes(data.ticketTypes);
        if (data.efterkop) setEfterkop(data.efterkop);
        if (data.kiosk) setKiosk(data.kiosk);
        if (data.swish) setSwish(data.swish);
        if (data.epassi) setEpassi(data.epassi);
        if (Array.isArray(data.pendingSwish)) setPendingSwish(data.pendingSwish);
        if (poll) {
          if (data.sales.length > 0) setSales((prev) => [...data.sales, ...prev].slice(0, 8));
        } else {
          setSales(data.sales);
        }
        since.current = data.now;
      } catch {
        setError(t("connectionLost"));
      } finally {
        setLoading(false);
      }
    },
    [id, t]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const soldOut = (tt: TicketType) => tt.capacity != null && tt.tickets_sold >= tt.capacity;

  /**
   * Gästen har swishat och visat kvittot. Registrera = bokningen skapas
   * bekräftad och incheckad på en gång; gästen står ju framför dig.
   */
  async function registreraSwish() {
    if (!selected || swishState === "sparar") return;
    setSwishState("sparar");
    try {
      const res = await fetch(`/api/events/${id}/entry/swish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketTypeId: selected.id, guestCount: swishCount, name: swishName, email: swishEmail }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSwishState("klar");
      setSwishName("");
      setSwishEmail("");
      setSwishCount(1);
      load(true);
      setTimeout(() => setSwishState("idle"), 4000);
    } catch {
      setSwishState("fel");
    }
  }

  /**
   * Avgör ett vilande Swish-köp från eventsidan. Bekräfta = biljetten räknas
   * och QR-koden mejlas (och gästen checkas in om hen står här). Avvisa =
   * ingen betalning hittades, bokningen avbokas.
   */
  async function avgorSwish(bookingId: string, action: "confirm" | "reject") {
    if (pendingBusy) return;
    setPendingBusy(bookingId);
    try {
      const res = await fetch(`/api/events/${id}/entry/swish/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action, checkIn: action === "confirm" && pendingCheckIn }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPendingSwish((prev) => prev.filter((p) => p.id !== bookingId));
      // Hela listan igen: bokningen skapades när gästen tryckte, så en
      // since-poll skulle inte se den som ny under "Betalt nyss".
      load(false);
    } catch {
      setError(t("swishError"));
    } finally {
      setPendingBusy(null);
    }
  }

  /**
   * Gästen visar kvittot för kvällen i Epassi-appen och legitimation.
   * Namnet krävs — det jämförs mot Epassis leverantörsportal i efterhand.
   */
  async function registreraEpassi() {
    if (!selected || !epassiName.trim() || epassiState === "sparar") return;
    setEpassiState("sparar");
    try {
      const res = await fetch(`/api/events/${id}/entry/epassi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketTypeId: selected.id, guestCount: epassiCount, name: epassiName }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEpassiState("klar");
      setEpassiName("");
      setEpassiCount(1);
      load(true);
      setTimeout(() => setEpassiState("idle"), 4000);
    } catch {
      setEpassiState("fel");
    }
  }

  /**
   * Hämtar en betallänk och lägger den i urklipp.
   *
   * Länken skapas FÖRST när knappen trycks, inte när sidan laddas. En
   * betalningslänk som ligger och väntar i gränssnittet är en länk som kan
   * hamna fel, och den har dessutom hunnit bli gammal när någon väl behöver
   * den.
   */
  const kopieraLank = useCallback(async () => {
    if (!selected) return;
    setLank("hamtar");
    try {
      const res = await fetch(
        `/api/events/${id}/entry/efterkop-lank?tt=${encodeURIComponent(selected.id)}`,
        { method: "POST" }
      );
      if (!res.ok) { setLank("fel"); return; }
      const data = await res.json();
      // Skrivningen till urklipp kan nekas (saknad behörighet, osäker kontext).
      // Då är länken ändå hämtad, så den visas i klartext att markera för hand
      // i stället för att bara misslyckas.
      try {
        await navigator.clipboard.writeText(data.url);
        setLank("kopierad");
      } catch {
        window.prompt(t("lateCopyManual"), data.url);
        setLank("kopierad");
      }
      setTimeout(() => setLank("idle"), 4000);
    } catch {
      setLank("fel");
    }
  }, [id, selected, t]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--usha-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <Link
        href={`/app/events/${id}/edit`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
      >
        <ArrowLeft size={16} />
        {t("back")}
      </Link>

      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{title}</p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Kvällen har varit. Värden måste veta att det här INTE är vanlig
          entréförsäljning, utan en betalning för något som redan hänt — annars
          är det lätt att tro att man sålt en biljett till ikväll. */}
      {efterkop.oppet && (
        <p className="mt-4 rounded-lg border border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/10 px-3 py-2 text-sm text-[var(--usha-gold)]">
          {t("lateOpen")}
        </p>
      )}
      {efterkop.stangt && (
        <p className="mt-4 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-sm text-[var(--usha-muted)]">
          {t("lateClosed")}
        </p>
      )}

      {!selected ? (
        <>
          <p className="mt-6 text-sm text-[var(--usha-muted)]">{t("pickTicket")}</p>
          <div className="mt-3 space-y-2">
            {types.length === 0 && (
              <p className="rounded-xl border border-[var(--usha-border)] p-4 text-sm text-[var(--usha-muted)]">
                {t("noTicketTypes")}
              </p>
            )}
            {types.map((tt) => (
              <button
                key={tt.id}
                onClick={() => setSelected(tt)}
                disabled={soldOut(tt) || efterkop.stangt}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--usha-border)] p-4 text-left transition hover:border-[var(--usha-gold)]/60 disabled:opacity-40"
              >
                <span className="font-medium">{tt.name}</span>
                <span className="text-[var(--usha-gold)]">
                  {soldOut(tt) ? t("soldOut") : t("priceSek", { price: tt.price })}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6">
          <div className="rounded-2xl bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/events/${id}/entry/qr?tt=${encodeURIComponent(selected.id)}${efterkop.oppet ? "&efterkop=1" : ""}`}
              alt={t("qrAlt", { ticket: selected.name })}
              className="mx-auto block h-auto w-full max-w-[320px]"
            />
          </div>
          <p className="mt-4 text-center text-lg font-semibold">
            {selected.name} · {t("priceSek", { price: selected.price })}
          </p>
          <p className="mt-1 text-center text-sm text-[var(--usha-muted)]">{t("guestScans")}</p>

          {/* Swish Företag via Nordea. Pengarna landar på bolagets konto, inte
              hos Stripe — därför registreras betalningen för hand av den som
              ser kvittot, och avräkningen håller raden utanför Stripe. */}
          {swish.enabled && !efterkop.oppet && (
            <div className="mt-4 rounded-2xl border border-[var(--usha-border)] p-3">
              <button
                onClick={() => setSwishOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
              >
                <span className="inline-flex items-center gap-2"><Smartphone size={15} /> {t("swishToggle")}</span>
                <span className="text-xs text-[var(--usha-muted)]">{swishOpen ? t("swishHide") : t("swishShow")}</span>
              </button>
              {swishOpen && (
                <div className="mt-3">
                  <div className="rounded-2xl bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/events/${id}/entry/swish-qr?tt=${encodeURIComponent(selected.id)}`}
                      alt={t("swishQrAlt", { ticket: selected.name })}
                      className="mx-auto block h-auto w-full max-w-[320px]"
                    />
                  </div>
                  <p className="mt-3 text-center text-sm">
                    {t("swishNumber")} <span className="font-mono font-semibold">{swish.formatted}</span> · {t("priceSek", { price: selected.price })}
                  </p>
                  <p className="mt-1 text-center text-xs text-[var(--usha-muted)]">{t("swishHint")}</p>

                  <div className="mt-4 space-y-2">
                    <div className="flex gap-2">
                      <input value={swishName} onChange={(e) => setSwishName(e.target.value)} placeholder={t("swishName")} className="min-w-0 flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm" maxLength={120} />
                      <select value={swishCount} onChange={(e) => setSwishCount(Number(e.target.value))} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-2 py-2 text-sm">
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <input value={swishEmail} onChange={(e) => setSwishEmail(e.target.value)} placeholder={t("swishEmail")} type="email" className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm" maxLength={254} />
                    <button
                      onClick={registreraSwish}
                      disabled={swishState === "sparar"}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black disabled:opacity-60 ${swishState === "klar" ? "bg-green-500" : "bg-[var(--usha-gold)]"}`}
                    >
                      {swishState === "sparar" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {swishState === "klar" ? t("swishRegistered") : t("swishRegister", { price: selected.price * swishCount })}
                    </button>
                    {swishState === "fel" && <p className="text-center text-xs text-red-400">{t("swishError")}</p>}
                    <p className="text-center text-xs text-[var(--usha-muted)]">{t("swishRegisterHint")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Epassi i dörren: gästen har köpt kvällen i Epassi-appen. Epassi har
              inget API, så den som ser kvittot och legitimationen registrerar. */}
          {epassi.enabled && !efterkop.oppet && (
            <div className="mt-4 rounded-2xl border border-[var(--usha-border)] p-3">
              <button
                onClick={() => setEpassiOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
              >
                <span className="inline-flex items-center gap-2"><HeartPulse size={15} /> {t("epassiToggle")}</span>
                <span className="text-xs text-[var(--usha-muted)]">{epassiOpen ? t("swishHide") : t("swishShow")}</span>
              </button>
              {epassiOpen && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--usha-muted)]">{t("epassiHint")}</p>
                  <div className="flex gap-2">
                    <input value={epassiName} onChange={(e) => setEpassiName(e.target.value)} placeholder={t("epassiName")} className="min-w-0 flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm" maxLength={120} />
                    <select value={epassiCount} onChange={(e) => setEpassiCount(Number(e.target.value))} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-2 py-2 text-sm">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={registreraEpassi}
                    disabled={epassiState === "sparar" || !epassiName.trim()}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black disabled:opacity-60 ${epassiState === "klar" ? "bg-green-500" : "bg-[var(--usha-gold)]"}`}
                  >
                    {epassiState === "sparar" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {epassiState === "klar" ? t("swishRegistered") : t("epassiRegister", { price: selected.price * epassiCount })}
                  </button>
                  {epassiState === "fel" && <p className="text-center text-xs text-red-400">{t("swishError")}</p>}
                  <p className="text-center text-xs text-[var(--usha-muted)]">{t("epassiRegisterHint")}</p>
                </div>
              )}
            </div>
          )}

          {/* Plattan i dörren: samma köp-QR plus frontkameran, så gästerna
              checkar in sig själva. Premium-funktion: öppen under betan,
              annars bara när värden har Premium. */}
          {kiosk && kiosk.allowed ? (
            <>
              <Link
                href={`/sjalvinslapp/${id}?tt=${encodeURIComponent(selected.id)}`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-gold)]/50 py-3 text-sm font-medium text-[var(--usha-gold)] transition hover:bg-[var(--usha-gold)]/10"
              >
                <ScanLine size={15} />
                {t("kioskButton")}
              </Link>
              <p className="mt-2 text-center text-xs text-[var(--usha-muted)]">
                {kiosk.beta ? t("kioskBetaBadge") : t("kioskPremiumBadge")}
              </p>
            </>
          ) : kiosk ? (
            <Link
              href="/dashboard/billing"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/60"
            >
              <Lock size={15} />
              {t("kioskLocked")}
            </Link>
          ) : null}

          {/* Bara vid efterköp. På en pågående kväll står gästen framför dig
              och ska scanna — en länk att skicka vore en omväg. */}
          {efterkop.oppet && (
            <>
              <button
                onClick={kopieraLank}
                disabled={lank === "hamtar"}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/60 disabled:opacity-50"
              >
                {lank === "hamtar" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : lank === "kopierad" ? (
                  <Check size={15} className="text-green-400" />
                ) : (
                  <Link2 size={15} />
                )}
                {lank === "kopierad" ? t("lateCopied") : t("lateCopyLink")}
              </button>
              <p className="mt-2 text-center text-xs text-[var(--usha-muted)]">
                {lank === "fel" ? t("lateCopyError") : t("lateLinkHint")}
              </p>
            </>
          )}

          <button
            onClick={() => setSelected(null)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/60"
          >
            <RefreshCw size={15} />
            {t("otherTicket")}
          </button>
        </div>
      )}

      {/* Swish-köp från eventsidan som väntar på att någon jämför mot
          Swish-appen. Ligger ÖVER "Betalt nyss": det är det som kräver en
          handling, och gästen står ofta i dörren och väntar på svaret. */}
      {pendingSwish.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            {t("swishPendingHeading")}
          </p>
          <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("swishPendingHint")}</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--usha-muted)]">
            <input type="checkbox" checked={pendingCheckIn} onChange={(e) => setPendingCheckIn(e.target.checked)} className="h-4 w-4 accent-[var(--usha-gold)]" />
            {t("swishPendingCheckIn")}
          </label>
          <ul className="mt-3 space-y-2">
            {pendingSwish.map((p) => (
              <li key={p.id} className="rounded-xl border border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="shrink-0 text-[var(--usha-gold)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.guest_name || p.guest_email || t("guest")}</p>
                    <p className="truncate text-xs text-[var(--usha-muted)]">
                      {p.guest_name && p.guest_email ? `${p.guest_email} · ` : ""}
                      {p.ticket_type_name ?? ""}
                      {p.guest_count && p.guest_count > 1 ? ` · ${t("seats", { n: p.guest_count })}` : ""}
                    </p>
                  </div>
                  {p.amount_paid != null && (
                    <span className="shrink-0 text-sm font-semibold text-[var(--usha-gold)]">
                      {t("priceSek", { price: Math.round(p.amount_paid / 100) })}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => avgorSwish(p.id, "confirm")}
                    disabled={pendingBusy !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--usha-gold)] py-2.5 text-sm font-bold text-black disabled:opacity-60"
                  >
                    {pendingBusy === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {t("swishPendingConfirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => avgorSwish(p.id, "reject")}
                    disabled={pendingBusy !== null}
                    className="rounded-xl border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-red-400/60 hover:text-red-400 disabled:opacity-60"
                  >
                    {t("swishPendingReject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sales.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            {t("paidHeading")}
          </p>
          <ul className="mt-3 space-y-2">
            {sales.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3"
              >
                <CheckCircle2 size={18} className="shrink-0 text-green-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.guest_name || s.guest_email || t("guest")}
                  </p>
                  <p className="truncate text-xs text-[var(--usha-muted)]">
                    {s.payment_method === "swish" ? `${t("swishTag")} · ` : s.payment_method === "epassi" ? `${t("epassiTag")} · ` : ""}
                    {s.ticket_type_name ?? ""}
                    {s.guest_count && s.guest_count > 1 ? ` · ${t("seats", { n: s.guest_count })}` : ""}
                  </p>
                </div>
                {s.amount_paid != null && (
                  <span className="shrink-0 text-sm text-[var(--usha-gold)]">
                    {t("priceSek", { price: Math.round(s.amount_paid / 100) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
