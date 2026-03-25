"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, CheckCircle, XCircle, Search, AlertCircle, UserCheck, Loader2 } from "lucide-react";

interface TicketResult {
  valid: boolean;
  status: string;
  bookingId: string;
  ticket: {
    code: string;
    title: string;
    date: string;
    time: string | null;
    location: string | null;
  };
}

interface CheckInResult {
  success: boolean;
  alreadyCheckedIn?: boolean;
  checkedInAt?: string;
  title?: string;
  error?: string;
  status?: string;
}

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [checkInDone, setCheckInDone] = useState<CheckInResult | null>(null);
  const [error, setError] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Start QR scanner
  async function startScanner() {
    if (scannerRef.current) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR decoded — extract code from URL or direct code
          handleQrResult(decodedText);
          stopScanner();
        },
        () => {
          // Ignore scan failures (frames without QR)
        }
      );
      setScannerActive(true);
    } catch (err) {
      console.error("Scanner start failed:", err);
      setError("Kunde inte starta kameran. Kontrollera att du gett tillgång till kameran.");
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Parse QR result — could be a URL or direct code
  function handleQrResult(text: string) {
    // Try URL format: .../api/tickets/verify?code=USH-XXXXXXXX&id=...
    const urlMatch = text.match(/code=(USH-[A-Fa-f0-9]{8})/i);
    if (urlMatch) {
      verifyCode(urlMatch[1].toUpperCase());
      return;
    }

    // Try direct code format: USH-XXXXXXXX
    const codeMatch = text.match(/^USH-([A-Fa-f0-9]{8})$/i);
    if (codeMatch) {
      verifyCode(text.toUpperCase());
      return;
    }

    setError("QR-koden kunde inte tolkas. Prova ange koden manuellt.");
  }

  async function verifyCode(ticketCode: string) {
    setError("");
    setResult(null);
    setCheckInDone(null);
    setLoading(true);
    setCode(ticketCode);

    const match = ticketCode.match(/^USH-([A-Fa-f0-9]{8})$/i);
    if (!match) {
      setError("Ogiltigt kodformat. Förväntat: USH-XXXXXXXX");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/tickets/verify?code=${encodeURIComponent(ticketCode)}&id=${match[1]}`
      );
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError("Du kan bara skanna biljetter för dina egna evenemang.");
        } else {
          setError(data.error || "Kunde inte verifiera biljett");
        }
      } else {
        setResult(data);
      }
    } catch {
      setError("Nätverksfel. Försök igen.");
    }
    setLoading(false);
  }

  async function handleCheckIn() {
    if (!result?.bookingId) return;

    setCheckingIn(true);
    try {
      const res = await fetch("/api/tickets/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: result.bookingId }),
      });
      const data: CheckInResult = await res.json();
      setCheckInDone(data);
    } catch {
      setCheckInDone({ success: false, error: "Nätverksfel" });
    }
    setCheckingIn(false);
  }

  function handleManualVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) verifyCode(trimmed);
  }

  function resetScan() {
    setResult(null);
    setCheckInDone(null);
    setError("");
    setCode("");
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Skanna biljetter</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Skanna QR-koden eller ange biljettkoden manuellt.
        </p>
      </div>

      {/* QR Scanner */}
      {!result && !checkInDone && (
        <>
          <div className="mb-4 overflow-hidden rounded-xl border border-[var(--usha-border)] bg-black">
            <div id="qr-reader" ref={scannerContainerRef} className="w-full" />
            {!scannerActive && (
              <button
                onClick={startScanner}
                className="flex w-full items-center justify-center gap-2 bg-[var(--usha-card)] py-12 text-sm text-[var(--usha-muted)] transition hover:text-white"
              >
                <Camera size={24} />
                <span>Tryck för att starta kameran</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1 border-t border-[var(--usha-border)]" />
            <span className="text-xs text-[var(--usha-muted)]">eller ange kod</span>
            <div className="flex-1 border-t border-[var(--usha-border)]" />
          </div>

          {/* Manual code entry */}
          <form onSubmit={handleManualVerify} className="mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]"
                />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="USH-A1B2C3D4"
                  className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-3 pl-10 pr-4 font-mono text-sm uppercase outline-none transition focus:border-[var(--usha-gold)]/40"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
          <XCircle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="font-semibold text-red-400">Fel</p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{error}</p>
          <button
            onClick={() => { setError(""); resetScan(); }}
            className="mt-3 rounded-xl border border-[var(--usha-border)] px-6 py-2 text-sm transition hover:bg-[var(--usha-card)]"
          >
            Försök igen
          </button>
        </div>
      )}

      {/* Verify Result (before check-in) */}
      {result && !checkInDone && (
        <div
          className={`rounded-xl border p-6 text-center ${
            result.valid
              ? "border-green-500/20 bg-green-500/10"
              : "border-red-500/20 bg-red-500/10"
          }`}
        >
          {result.valid ? (
            <>
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
              <p className="text-lg font-bold text-green-400">Giltig biljett</p>
            </>
          ) : (
            <>
              <XCircle size={48} className="mx-auto mb-3 text-red-400" />
              <p className="text-lg font-bold text-red-400">
                {result.status === "already_used" ? "Redan insläppt" :
                 result.status === "canceled" ? "Avbokad" :
                 result.status === "pending" ? "Ej bekräftad" :
                 "Ogiltig biljett"}
              </p>
            </>
          )}

          <div className="mt-4 space-y-1 text-sm">
            <p className="font-semibold">{result.ticket.title}</p>
            <p className="text-[var(--usha-muted)]">
              <span className="font-mono">{result.ticket.code}</span>
            </p>
            <p className="text-[var(--usha-muted)]">
              {result.ticket.date}
              {result.ticket.time && ` · ${result.ticket.time}`}
            </p>
            {result.ticket.location && (
              <p className="text-[var(--usha-muted)]">{result.ticket.location}</p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {result.valid && (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
              >
                {checkingIn ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserCheck size={16} />
                )}
                Registrera insläpp
              </button>
            )}
            <button
              onClick={resetScan}
              className="rounded-xl border border-[var(--usha-border)] px-6 py-2 text-sm transition hover:bg-[var(--usha-card)]"
            >
              Skanna nästa
            </button>
          </div>
        </div>
      )}

      {/* Check-in Result */}
      {checkInDone && (
        <div
          className={`rounded-xl border p-6 text-center ${
            checkInDone.success
              ? "border-green-500/20 bg-green-500/10"
              : checkInDone.alreadyCheckedIn
                ? "border-yellow-500/20 bg-yellow-500/10"
                : "border-red-500/20 bg-red-500/10"
          }`}
        >
          {checkInDone.success ? (
            <>
              <UserCheck size={48} className="mx-auto mb-3 text-green-400" />
              <p className="text-lg font-bold text-green-400">Insläpp registrerat!</p>
              <p className="mt-2 text-sm font-medium">{checkInDone.title}</p>
              <p className="mt-1 text-xs text-[var(--usha-muted)]">
                {new Date(checkInDone.checkedInAt!).toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          ) : checkInDone.alreadyCheckedIn ? (
            <>
              <AlertCircle size={48} className="mx-auto mb-3 text-yellow-400" />
              <p className="text-lg font-bold text-yellow-400">Redan insläppt</p>
              <p className="mt-2 text-sm font-medium">{checkInDone.title}</p>
              <p className="mt-1 text-xs text-[var(--usha-muted)]">
                Incheckning: {new Date(checkInDone.checkedInAt!).toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          ) : (
            <>
              <XCircle size={48} className="mx-auto mb-3 text-red-400" />
              <p className="text-lg font-bold text-red-400">Kunde inte checka in</p>
              <p className="mt-2 text-sm text-[var(--usha-muted)]">
                {checkInDone.error}
              </p>
            </>
          )}

          <button
            onClick={resetScan}
            className="mt-6 rounded-xl border border-[var(--usha-border)] px-6 py-3 text-sm font-medium transition hover:bg-[var(--usha-card)]"
          >
            Skanna nästa biljett
          </button>
        </div>
      )}
    </div>
  );
}
