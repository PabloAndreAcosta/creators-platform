"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
