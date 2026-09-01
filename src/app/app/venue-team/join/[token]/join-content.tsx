"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

export default function JoinContent({
  token, gone, venueName, capabilities, labels,
}: {
  token: string;
  gone: boolean;
  venueName: string | null;
  capabilities: string[];
  labels: {
    heading: string; intro: string; goneTitle: string; goneBody: string;
    accept: string; accepted: string; failed: string; nothing: string;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function accept() {
    setState("busy");
    try {
      const r = await fetch("/api/venue/members/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) throw new Error();
      setState("done");
      setTimeout(() => router.push("/app"), 1500);
    } catch {
      setState("error");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--usha-black)] text-[var(--usha-white)]">
      <div className="mx-auto max-w-md px-4 py-16">
        {gone ? (
          <>
            <h1 className="mb-2 text-xl font-bold">{labels.goneTitle}</h1>
            <p className="text-sm text-[var(--usha-muted)]">{labels.goneBody}</p>
          </>
        ) : state === "done" ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            {labels.accepted}
          </p>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">{labels.heading}</h1>
            <p className="mb-6 text-sm text-[var(--usha-muted)]">{labels.intro}</p>

            <div className="mb-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
              {capabilities.length === 0 ? (
                <p className="text-sm text-[var(--usha-muted)]">{labels.nothing}</p>
              ) : (
                <ul className="space-y-2">
                  {capabilities.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm">
                      <Check size={14} className="text-[var(--usha-gold)]" />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {state === "error" && (
              <p className="mb-4 text-xs text-red-300">{labels.failed}</p>
            )}

            <button
              onClick={accept}
              disabled={state === "busy"}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {labels.accept}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
