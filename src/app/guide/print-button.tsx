"use client";

import { Printer } from "lucide-react";

/**
 * Utskriftsknapp. Guiden ska gå att skicka vidare som fil, och webbläsarens
 * egen utskrift till PDF är den enda vägen som fungerar överallt utan att vi
 * genererar dokument på servern.
 *
 * Knappen döljs i utskriften — den är meningslös på papper.
 */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--usha-border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--usha-gold)]/40 print:hidden"
    >
      <Printer size={14} />
      {label}
    </button>
  );
}
