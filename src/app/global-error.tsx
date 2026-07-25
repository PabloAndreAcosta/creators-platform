"use client";

// Global error boundary. This is the LAST resort — it catches errors thrown by
// the root layout itself, so it fully REPLACES that layout and must therefore
// render its own <html> and <body>. globals.css is imported here because the
// root layout (which normally imports it) is bypassed when this renders. Inline
// styles guarantee a legible, centered fallback even if the stylesheet failed
// to load — the very thing that can break the root layout.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sv">
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
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
          Något gick fel
        </h2>
        <p style={{ margin: "0 0 24px", maxWidth: "28rem", fontSize: "14px", color: "#a1a1aa" }}>
          {error.message || "Ett oväntat fel uppstod. Ladda om sidan och försök igen."}
        </p>
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
            Försök igen
          </button>
          <a
            href="/"
            style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 500, color: "#a1a1aa", textDecoration: "none" }}
          >
            Till startsidan
          </a>
        </div>
        {error.digest && (
          <p style={{ marginTop: "24px", fontSize: "12px", color: "#71717a" }}>
            Felkod: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
