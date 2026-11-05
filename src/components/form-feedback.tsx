"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Skicka-knapp som syns arbeta. Utan den ser en långsam anslutning ut som en
 * knapp som inte reagerar, och folk trycker igen eller stänger appen.
 */
export function PendingButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Beskedet efter ett formulär hamnar överst på sidan medan knappen sitter
 * längst ner. Rulla dit, annars ser det ut som att ingenting hände.
 */
export function ScrollIntoViewNotice({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  return (
    <div ref={ref} role="status" className={className}>
      {children}
    </div>
  );
}

/**
 * Knapp för det som inte går att ångra med ett tryck, som att avboka ett pass.
 * Första trycket frågar, andra skickar. Utan det räckte ett feltryck på
 * telefonen för att avboka – det hände en taxidansare samma dag som passet.
 */
export function ConfirmButton({
  children,
  question,
  confirmLabel,
  keepLabel,
  pendingLabel,
  className,
  confirmClassName,
}: {
  children: ReactNode;
  question: string;
  confirmLabel: string;
  keepLabel: string;
  pendingLabel: string;
  className?: string;
  confirmClassName?: string;
}) {
  const [asking, setAsking] = useState(false);
  const { pending } = useFormStatus();
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label={question}>
      <span className="text-xs text-[var(--usha-muted)]">{question}</span>
      <button type="submit" disabled={pending} aria-busy={pending} className={`${confirmClassName ?? className ?? ""} disabled:opacity-60`}>
        {pending ? pendingLabel : confirmLabel}
      </button>
      <button type="button" disabled={pending} className={className} onClick={() => setAsking(false)}>
        {keepLabel}
      </button>
    </span>
  );
}
