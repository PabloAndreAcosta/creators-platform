"use client";

import { useState, useRef, useEffect } from "react";
import { Flag, ShieldOff, AlertTriangle, X, Loader2 } from "lucide-react";

type Step = "menu" | "confirm-block" | "report-form" | "success";

export function ReportUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleClose() {
    setOpen(false);
    setStep("menu");
    setReason("");
    setLoading(false);
    setSuccessMessage("");
  }

  async function handleBlock() {
    setLoading(true);
    try {
      const res = await fetch("/api/users/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type: "block" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Något gick fel.");
        setLoading(false);
        return;
      }
      setSuccessMessage("Användaren har blockerats");
      setStep("success");
    } catch {
      alert("Något gick fel. Försök igen senare.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReport() {
    if (reason.trim().length < 10) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: reason.trim(), type: "report" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Något gick fel.");
        setLoading(false);
        return;
      }
      setSuccessMessage("Rapport skickad");
      setStep("success");
    } catch {
      alert("Något gick fel. Försök igen senare.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            setOpen(true);
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--usha-muted)]"
        aria-label={`Rapportera eller blockera ${userName}`}
      >
        <Flag size={16} className="text-[var(--usha-muted-foreground,#888)]" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] shadow-lg"
        >
          {/* Menu */}
          {step === "menu" && (
            <div className="flex flex-col">
              <button
                onClick={() => setStep("confirm-block")}
                className="flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--usha-muted)]"
              >
                <ShieldOff size={16} />
                <span>Blockera {userName}</span>
              </button>
              <button
                onClick={() => setStep("report-form")}
                className="flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--usha-muted)]"
              >
                <AlertTriangle size={16} />
                <span>Rapportera {userName}</span>
              </button>
            </div>
          )}

          {/* Confirm block */}
          {step === "confirm-block" && (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm">
                Är du säker på att du vill blockera{" "}
                <strong>{userName}</strong>? Denne kommer inte kunna kontakta
                dig.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("menu")}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--usha-muted)]"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleBlock}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Blockera
                </button>
              </div>
            </div>
          )}

          {/* Report form */}
          {step === "report-form" && (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Rapportera {userName}
                </p>
                <button
                  onClick={() => setStep("menu")}
                  className="rounded p-1 transition-colors hover:bg-[var(--usha-muted)]"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Beskriv varför du rapporterar denna användare (minst 10 tecken)..."
                rows={3}
                className="w-full resize-none rounded-lg border border-[var(--usha-border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--usha-muted-foreground,#888)] focus:outline-none focus:ring-1 focus:ring-[var(--usha-border)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("menu")}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--usha-muted)]"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleReport}
                  disabled={loading || reason.trim().length < 10}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Skicka rapport
                </button>
              </div>
              {reason.length > 0 && reason.trim().length < 10 && (
                <p className="text-xs text-red-500">
                  Minst 10 tecken krävs ({reason.trim().length}/10)
                </p>
              )}
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                &#10003;
              </div>
              <p className="text-sm font-medium">{successMessage}</p>
              <button
                onClick={handleClose}
                className="mt-1 rounded-lg border border-[var(--usha-border)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--usha-muted)]"
              >
                Stäng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
