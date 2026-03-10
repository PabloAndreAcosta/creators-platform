"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, Star } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export function UpgradePrompt({
  open,
  onClose,
  message = "Uppgradera till Guld eller Premium för att låsa upp denna funktion.",
}: UpgradePromptProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      dialogRef.current?.focus();
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        tabIndex={-1}
        className="w-full max-w-md bg-[var(--usha-card)] border border-[var(--usha-gold)]/20 rounded-t-2xl sm:rounded-2xl p-6 space-y-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <Star size={16} className="text-black" />
            </div>
            <h3 id="upgrade-title" className="text-lg font-bold">Uppgradera</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] transition hover:text-white"
            aria-label="Stäng"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--usha-muted)] leading-relaxed">
          {message}
        </p>

        <div className="space-y-3">
          <Link
            href="/dashboard/billing"
            className="block w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
          >
            Se planer och priser
          </Link>
          <button
            onClick={onClose}
            className="block w-full rounded-xl border border-[var(--usha-border)] py-3 text-center text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
          >
            Inte nu
          </button>
        </div>
      </div>
    </div>
  );
}
