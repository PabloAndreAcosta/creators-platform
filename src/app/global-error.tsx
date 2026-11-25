"use client";

// Global error boundary. This is the LAST resort — it catches errors thrown by
// the root layout itself, so it fully REPLACES that layout and must therefore
// render its own <html> and <body>. globals.css is imported here because the
// root layout (which normally imports it) is bypassed when this renders. Inline
// styles guarantee a legible, centered fallback even if the stylesheet failed
// to load — the very thing that can break the root layout.
//
// No IntlProvider exists here (it lives in the root layout), so the texts come
// from the small static-texts.json in three languages: language cookie first,
// then the device language, else Swedish. static-texts.test.ts keeps that file
// equal to the message files.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as Sentry from "@sentry/nextjs";
import STATIC_TEXTS from "@/lib/feedback/static-texts.json";
import { detectStaticLocale, fillCode, type FeedbackLocale } from "@/lib/feedback/texts";
import "./globals.css";

const FeedbackDialog = dynamic(() => import("@/components/feedback/feedback-dialog"), { ssr: false });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<FeedbackLocale>("sv");
  const [eventId, setEventId] = useState<string | undefined>();
  const [canReport, setCanReport] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEventId(Sentry.captureException(error));
    setCanReport(!!Sentry.getClient());
  }, [error]);

  useEffect(() => {
    try {
      setLocale(detectStaticLocale(document.cookie, navigator.languages ?? [navigator.language]));
    } catch {
      // Stannar på svenska.
    }
  }, []);

  const t = STATIC_TEXTS[locale].errorPage;

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>{t.title}</h2>
        <p style={{ margin: "0 0 24px", maxWidth: "28rem", fontSize: "14px", color: "#a1a1aa" }}>
          {error.message || t.reloadFallback}
        </p>
        {canReport && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              marginBottom: "16px",
              width: "100%",
              maxWidth: "20rem",
              borderRadius: "8px",
              border: "none",
              background: "#D4AF37",
              color: "#000",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.report}
          </button>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              borderRadius: "8px",
              border: "1px solid #27272a",
              background: "transparent",
              color: "inherit",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
          <a
            href="/"
            style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 500, color: "#a1a1aa", textDecoration: "none" }}
          >
            {t.home}
          </a>
        </div>
        {error.digest && (
          <p style={{ marginTop: "24px", fontSize: "12px", color: "#71717a" }}>{fillCode(t.code, error.digest)}</p>
        )}
        {open && (
          <FeedbackDialog
            texts={STATIC_TEXTS[locale].feedback}
            locale={locale}
            source="felsida"
            associatedEventId={eventId}
            digest={error.digest}
            onClose={() => setOpen(false)}
          />
        )}
      </body>
    </html>
  );
}
