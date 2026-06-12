import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Usch-Ja! — Skapa event, sälj biljetter, betala ditt crew";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0b",
          color: "#fafaf9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 44 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #c8a445, #ff6b35)",
              fontSize: 56,
              fontWeight: 800,
              color: "#0a0a0b",
            }}
          >
            U
          </div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>Usch-Ja!</div>
        </div>
        <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
          Skapa event. Sälj biljetter. Betala ditt crew.
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#8b8b8b", marginTop: 30 }}>
          Tryggt med BankID &amp; Stripe · usha.se
        </div>
      </div>
    ),
    { ...size }
  );
}
