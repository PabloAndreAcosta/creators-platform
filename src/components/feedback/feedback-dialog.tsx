"use client";

// Formuläret bakom felknappen. Laddas först när någon trycker (next/dynamic i
// feedback-launcher och felsidorna), så det kostar inget på vanliga sidvisningar.
// Ingen skärmdump och ingen Replay i steg 1.
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { appSkalTaggar } from "@/lib/sentry-app";
import { MAX_MESSAGE_LENGTH, sendFeedback, type FeedbackSource, type SendResult } from "@/lib/feedback/send";
import { sentryAdapter } from "@/lib/feedback/sentry-adapter";
import type { FeedbackTexts } from "@/lib/feedback/texts";

type Props = {
  texts: FeedbackTexts;
  locale: string;
  source: FeedbackSource;
  associatedEventId?: string;
  digest?: string;
  onClose: () => void;
};

type Phase = "edit" | "sending" | SendResult;

export default function FeedbackDialog({ texts, locale, source, associatedEventId, digest, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [shareUserId, setShareUserId] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const shareId = useId();

  // Bara för att veta om rutan ska visas. getSession läser lokalt, inget anrop.
  useEffect(() => {
    let alive = true;
    try {
      createClient()
        .auth.getSession()
        .then(({ data }) => {
          if (alive) setUserId(data.session?.user?.id);
        })
        .catch(() => {});
    } catch {
      // Ingen Supabase-konfiguration: rutan visas helt enkelt inte.
    }
    textareaRef.current?.focus();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "sending") return;
    setPhase("sending");
    const result = await sendFeedback(
      {
        message,
        href: window.location.href,
        locale,
        shellTags: appSkalTaggar(window),
        source,
        associatedEventId,
        digest,
        userId,
        shareUserId,
      },
      sentryAdapter,
    );
    setPhase(result);
  }

  const done = phase === "sent";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-t-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[var(--usha-white)] shadow-xl sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            {texts.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={texts.close}
            className="-m-1 rounded-lg p-1 text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div role="status">
            <p className="mb-4 text-sm">{texts.thanks}</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--usha-black)]"
            >
              {texts.close}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]" htmlFor={`${titleId}-msg`}>
              {texts.label}
            </label>
            <textarea
              id={`${titleId}-msg`}
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (phase === "empty") setPhase("edit");
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={4}
              placeholder={texts.placeholder}
              className="w-full resize-y rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm text-[var(--usha-white)] placeholder:text-[var(--usha-muted)] focus:border-[var(--usha-gold)] focus:outline-none"
            />

            {userId && (
              <div className="mt-3 flex items-start gap-2">
                <input
                  id={shareId}
                  type="checkbox"
                  checked={shareUserId}
                  onChange={(e) => setShareUserId(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--usha-gold)]"
                />
                <label htmlFor={shareId} className="text-sm">
                  {texts.shareUser}
                </label>
              </div>
            )}

            <p className="mt-3 text-xs text-[var(--usha-muted)]">
              {texts.notice}
              {associatedEventId || digest ? ` ${texts.errorAttached}` : ""}
            </p>

            {phase === "empty" && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {texts.empty}
              </p>
            )}
            {(phase === "failed" || phase === "unavailable") && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {texts.failed}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--usha-black)]"
              >
                {texts.cancel}
              </button>
              <button
                type="submit"
                disabled={phase === "sending"}
                className="flex-1 rounded-lg bg-[var(--usha-gold)] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              >
                {phase === "sending" ? texts.sending : texts.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
