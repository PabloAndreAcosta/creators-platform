"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Camera, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { vibrate } from "@/lib/haptics";

/**
 * Kioskläge i dörren: plattan skannar gästens biljett med frontkameran.
 *
 * Plattan på The Lab visade bara köp-QR:n; incheckningen gjorde någon i
 * teamet med sin egen telefon. Här gör gästen det själv: håller upp sin
 * biljett mot kameran, och skärmen svarar stort — grönt "Välkommen", gult
 * "Redan incheckad", rött "Fel kväll" — och går tillbaka till kameran av
 * sig själv. Inga knappar att trycka på.
 *
 * Samma kontroll som skannern i appen: /api/tickets/verify och
 * /api/tickets/checkin, båda bakom inloggning med skanningsrätt. Plattan är
 * inloggad (helst med ett eget dörrkonto som bara har can_scan), gästen är
 * det inte. Sidan är bunden till kvällens evenemang, så köp-QR:n och
 * skanningen gäller samma kväll.
 *
 * Kameran hålls igång mellan skanningar (pause/resume, inte stop/start) —
 * en omstart av kameran tar en sekund och känns som att plattan hängt sig.
 * Skärmen hålls vaken med Wake Lock och inloggningen vid liv med ett tyst
 * anrop var tionde minut.
 */

interface TicketType {
  id: string;
  name: string;
  price: number;
}

interface VerifyResult {
  valid: boolean;
  status: string;
  bookingId: string;
  attendeeId?: string | null;
  ticket: { title: string; date: string; ticketType?: string | null; holder?: string | null; seats?: number };
}

type Shown =
  | { kind: "ok"; ticketType: string | null; holder: string | null; seats: number; passRemaining: number | null }
  | { kind: "already"; ticketType: string | null; holder: string | null; time: string | null }
  | { kind: "wrong_date"; date: string }
  | { kind: "no"; status: string }
  | { kind: "error"; message: string };

/** Hur länge resultatet står innan kameran tar över igen. */
const SHOW_OK_MS = 4000;
const SHOW_FAIL_MS = 7000;
/** Samma kod inom den här tiden ignoreras — gästen håller kvar telefonen. */
const SAME_CODE_MS = 15000;
const KEEPALIVE_MS = 10 * 60 * 1000;

export default function EntranceKioskPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const t = useTranslations("scanPage");

  const [title, setTitle] = useState("");
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Kvällen och biljettypen för köp-QR:n. Typen kommer från entrésidan
  // (?tt=), annars första typen.
  useEffect(() => {
    let active = true;
    fetch(`/api/events/${id}/entry`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "noPermission" : "loadError");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTitle(data.listing.title);
        const types: TicketType[] = data.ticketTypes ?? [];
        const wanted = params.get("tt");
        setTicketType(types.find((x) => x.id === wanted) ?? types[0] ?? null);
      })
      .catch((e: Error) => active && setLoadError(e.message === "noPermission" ? t("kioskNoPermission") : t("errNetwork")));
    return () => {
      active = false;
    };
  }, [id, params, t]);

  // Håll inloggningen vid liv under kvällen. Middleware förnyar sessionen på
  // varje anrop; utan trafik skulle en lång kväll kunna sluta i /login mitt i kön.
  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/tickets/can-scan").catch(() => {});
    }, KEEPALIVE_MS);
    return () => clearInterval(timer);
  }, []);

  // Skärmen får inte slockna. Låset släpps när fliken göms och tas igen när
  // den syns — så beter sig Wake Lock i Chrome på Android.
  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wakeLockRef.current) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      // Ingen rättighet eller inget stöd — plattan får ställas in för hand.
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      wakeLockRef.current = null;
      if (document.visibilityState === "visible" && cameraOn) requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [cameraOn, requestWakeLock]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
      if (hideTimer.current) clearTimeout(hideTimer.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  function show(result: Shown) {
    setShown(result);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShown(null);
      busyRef.current = false;
      try {
        scannerRef.current?.resume();
      } catch {
        // Kameran kan ha tappats (t.ex. låst skärm) — nästa tryck startar om.
      }
    }, result.kind === "ok" ? SHOW_OK_MS : SHOW_FAIL_MS);
  }

  async function handleDecoded(text: string) {
    if (busyRef.current) return;
    const urlMatch = text.match(/code=(USH-[A-Fa-f0-9]{8})/i);
    const direct = text.match(/^USH-([A-Fa-f0-9]{8})$/i);
    const code = (urlMatch?.[1] ?? (direct ? text : null))?.toUpperCase();
    if (!code) return; // någon annans QR-kod — säg inget, vänta på rätt
    const att = text.match(/[?&]att=([0-9a-f-]{36})/i)?.[1];

    const now = Date.now();
    if (lastRef.current && lastRef.current.code === code && now - lastRef.current.at < SAME_CODE_MS) return;
    lastRef.current = { code, at: now };

    busyRef.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {
      // ignorerat
    }
    vibrate();

    try {
      const id8 = code.slice(4);
      const res = await fetch(`/api/tickets/verify?code=${encodeURIComponent(code)}&id=${id8}${att ? `&att=${att}` : ""}`);
      const data: VerifyResult & { error?: string } = await res.json();
      if (!res.ok) {
        show({ kind: "error", message: res.status === 403 ? t("errOnlyOwnEvents") : data.error || t("errCouldNotVerify") });
        return;
      }
      if (!data.valid) {
        if (data.status === "wrong_date") show({ kind: "wrong_date", date: data.ticket.date });
        else if (data.status === "already_used")
          show({ kind: "already", ticketType: data.ticket.ticketType ?? null, holder: data.ticket.holder ?? null, time: null });
        else show({ kind: "no", status: data.status });
        return;
      }

      // Giltig: checka in direkt. Det är hela poängen med kiosken.
      const ci = await fetch("/api/tickets/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.bookingId, attendeeId: data.attendeeId ?? undefined }),
      });
      const done = await ci.json();
      if (done.success) {
        vibrate([50, 30, 50]);
        show({
          kind: "ok",
          ticketType: data.ticket.ticketType ?? null,
          holder: data.ticket.holder ?? null,
          seats: data.ticket.seats ?? 1,
          passRemaining: done.passRemaining ?? null,
        });
      } else if (done.alreadyCheckedIn) {
        show({
          kind: "already",
          ticketType: data.ticket.ticketType ?? null,
          holder: data.ticket.holder ?? null,
          time: done.checkedInAt
            ? new Date(done.checkedInAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
            : null,
        });
      } else {
        show({ kind: "error", message: done.error || t("checkInFailed") });
      }
    } catch {
      show({ kind: "error", message: t("errNetwork") });
    }
  }

  async function startCamera() {
    if (scannerRef.current) return;
    setCameraStarting(true);
    setCameraError(null);
    try {
      // Helskärm och vaken skärm hör till ett kioskläge; båda får nekas utan
      // att något annat påverkas.
      document.documentElement.requestFullscreen?.().catch(() => {});
      await requestWakeLock();

      const { Html5Qrcode } = await import("html5-qrcode");
      // Webbläsarens egen QR-läsare (BarcodeDetector) när den finns — den tål
      // frontkamerans spegling och svagt ljus bättre än JS-avkodaren.
      const scanner = new Html5Qrcode("kiosk-reader", { useBarCodeDetectorIfSupported: true, verbose: false });
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: (w: number, h: number) => ({ width: Math.round(Math.min(w, h) * 0.7), height: Math.round(Math.min(w, h) * 0.7) }) };
      const onScan = (text: string) => void handleDecoded(text);
      const noop = () => {};
      // Frontkameran först: plattan står med skärmen mot gästen.
      try {
        await scanner.start({ facingMode: "user" }, config, onScan, noop);
      } catch (e1) {
        if (/NotAllowed|Permission|denied/i.test(String(e1))) throw e1;
        await scanner.start({ facingMode: "environment" }, config, onScan, noop);
      }
      setCameraOn(true);
    } catch (err) {
      scannerRef.current = null;
      setCameraError(/NotAllowed|Permission|denied/i.test(String(err)) ? t("cameraBlocked") : t("errCouldNotStartCamera"));
    } finally {
      setCameraStarting(false);
    }
  }

  const tone =
    shown?.kind === "ok" ? "bg-green-600" : shown?.kind === "already" ? "bg-yellow-500" : shown ? "bg-red-600" : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Diskret väg ut. Plattan bör dessutom vara låst till sidan (skärmfästning). */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-white/50">
        <Link href={`/app/events/${id}/entre`} className="inline-flex items-center gap-1 hover:text-white">
          <ArrowLeft size={14} /> {t("kioskExit")}
        </Link>
        <span className="truncate">{title}</span>
      </div>

      {loadError ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-xl">{loadError}</div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {/* Köp */}
          <section className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <h2 className="text-3xl font-bold">{t("kioskBuyTitle")}</h2>
            <p className="mt-1 text-lg text-white/60">{t("kioskBuyHint")}</p>
            {ticketType ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/events/${id}/entry/qr?tt=${encodeURIComponent(ticketType.id)}`}
                  alt=""
                  className="mt-6 w-full max-w-[320px] rounded-xl bg-white p-3"
                />
                <p className="mt-4 text-xl font-semibold">
                  {ticketType.name} · {t("kioskPrice", { price: ticketType.price })}
                </p>
              </>
            ) : (
              <p className="mt-6 text-white/60">{t("kioskNoTicketTypes")}</p>
            )}
          </section>

          {/* Visa biljett */}
          <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <h2 className="text-3xl font-bold">{t("kioskShowTitle")}</h2>
            <p className="mt-1 text-lg text-white/60">{t("kioskShowHint")}</p>
            <div className="relative mt-6 w-full max-w-[420px] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "1 / 1" }}>
              <div id="kiosk-reader" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
              {!cameraOn && (
                <button
                  onClick={startCamera}
                  disabled={cameraStarting}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/5 text-xl font-semibold disabled:opacity-60"
                >
                  {cameraStarting ? <Loader2 size={40} className="animate-spin" /> : <Camera size={40} />}
                  {cameraStarting ? t("startingCamera") : t("kioskStartCamera")}
                </button>
              )}
            </div>
            {cameraError && <p className="mt-3 text-sm text-red-300">{cameraError}</p>}

            {/* Resultatet lägger sig över hela rutan — det ska synas från två meter. */}
            {shown && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center ${tone}`} aria-live="assertive">
                {shown.kind === "ok" && (
                  <>
                    <CheckCircle2 size={96} />
                    <p className="mt-4 text-5xl font-black">{t("kioskWelcome")}</p>
                    {shown.ticketType && <p className="mt-4 text-4xl font-bold">{shown.ticketType}</p>}
                    {(shown.holder || shown.seats > 1) && (
                      <p className="mt-2 text-2xl">
                        {shown.holder}
                        {shown.seats > 1 && ` · ${t("seats", { n: shown.seats })}`}
                      </p>
                    )}
                    {shown.passRemaining != null && <p className="mt-2 text-xl">{t("passRemaining", { n: shown.passRemaining })}</p>}
                  </>
                )}
                {shown.kind === "already" && (
                  <>
                    <AlertCircle size={96} />
                    <p className="mt-4 text-5xl font-black">{t("statusAlreadyUsed")}</p>
                    {shown.ticketType && <p className="mt-4 text-3xl font-bold">{shown.ticketType}</p>}
                    {shown.holder && <p className="mt-2 text-2xl">{shown.holder}</p>}
                    {shown.time && <p className="mt-2 text-xl">{t("checkInTimeLabel", { time: shown.time })}</p>}
                    <p className="mt-4 text-lg opacity-80">{t("kioskAskCrew")}</p>
                  </>
                )}
                {shown.kind === "wrong_date" && (
                  <>
                    <XCircle size={96} />
                    <p className="mt-4 text-5xl font-black">{t("kioskWrongDate")}</p>
                    <p className="mt-4 text-2xl">{t("statusWrongDate", { date: shown.date })}</p>
                    <p className="mt-4 text-lg opacity-80">{t("kioskAskCrew")}</p>
                  </>
                )}
                {shown.kind === "no" && (
                  <>
                    <XCircle size={96} />
                    <p className="mt-4 text-5xl font-black">
                      {shown.status === "canceled" ? t("statusCanceled") : shown.status === "pending" ? t("statusPending") : t("statusInvalid")}
                    </p>
                    <p className="mt-4 text-lg opacity-80">{t("kioskAskCrew")}</p>
                  </>
                )}
                {shown.kind === "error" && (
                  <>
                    <XCircle size={96} />
                    <p className="mt-4 text-3xl font-bold">{shown.message}</p>
                    <p className="mt-4 text-lg opacity-80">{t("kioskAskCrew")}</p>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
