import { ImageResponse } from "next/og";
import { USHA_MARK_PNG } from "./og-logo";

export const runtime = "edge";
export const alt = "Usha Platform — Skapa event, sälj biljetter, checka in i dörren";
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
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 44 }}>
          {/* Det riktiga märket. Här stod tidigare en gradientfyrkant med
              bokstaven U i systemtypsnitt — en efterlikning av loggan, utan
              utropstecknet och med fel bokstavsform. Delningskortet är ofta
              det första någon ser av Usha, så det är inte stället att visa
              en ungefärlig logga. Botten är genomskinlig och kortet redan
              mörkt, så märket behöver ingen platta under sig. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={USHA_MARK_PNG} alt="" width={138} height={96} />
          <div style={{ fontSize: 56, fontWeight: 800 }}>Usha Platform</div>
        </div>
        <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
          Skapa event. Sälj biljetter. Checka in i dörren.
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#8b8b8b", marginTop: 30 }}>
          Tryggt med BankID &amp; Stripe · usha.se
        </div>
      </div>
    ),
    { ...size }
  );
}
