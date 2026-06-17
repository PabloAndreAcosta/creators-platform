"use client";

import { useEffect, useState } from "react";

export type LogoLage = "mork" | "ljus" | "system";
const NYCKEL = "uschja-logo-lage";

export function getLogoLage(): LogoLage {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(NYCKEL);
  return v === "mork" || v === "ljus" ? v : "system";
}
export function setLogoLage(lage: LogoLage) {
  localStorage.setItem(NYCKEL, lage);
  window.dispatchEvent(new Event("uschja-logo-lage"));
}

function arMork(lage: LogoLage): boolean {
  if (lage === "mork") return true;
  if (lage === "ljus") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function Monogram({ dag }: { dag: boolean }) {
  const id = dag ? "L" : "M";
  const platta = dag ? ["#FFFBEF", "#F7ECD2"] : ["#292524", "#0C0A09"];
  const guld = dag ? ["#E3BC4B", "#C9A22F", "#8F6F1F"] : ["#F5D061", "#D4AF37", "#A8842B"];
  const dot = dag ? ["#FEF3C7", "#E3BC4B", "#B08C28"] : ["#FEF3C7", "#F5D061", "#D4AF37"];
  const kant = dag ? "#C9A22F" : "#D4AF37";
  return (
    <svg viewBox="80 80 240 240" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id={`p${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={platta[0]} /><stop offset="100%" stopColor={platta[1]} /></linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={guld[0]} /><stop offset="55%" stopColor={guld[1]} /><stop offset="100%" stopColor={guld[2]} /></linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCD34D" /><stop offset="55%" stopColor="#FB923C" /><stop offset="100%" stopColor="#C2410C" /></linearGradient>
        <radialGradient id={`d${id}`} cx="50%" cy="38%" r="70%"><stop offset="0%" stopColor={dot[0]} /><stop offset="60%" stopColor={dot[1]} /><stop offset="100%" stopColor={dot[2]} /></radialGradient>
      </defs>
      <rect x="80" y="80" width="240" height="240" rx="64" fill={`url(#p${id})`} />
      <rect x="86" y="86" width="228" height="228" rx="58" fill="none" stroke={kant} strokeWidth="2" opacity=".6" />
      <path d="M128 156 L128 222 Q128 258 172 258 Q216 258 216 222 L216 156 L195 156 L195 220 Q195 239 172 239 Q149 239 149 220 L149 156 Z" fill={`url(#g${id})`} />
      <rect x="242" y="142" width="26" height="80" rx="13" fill={`url(#s${id})`} />
      <circle cx="255" cy="245" r="14" fill={`url(#d${id})`} />
    </svg>
  );
}

/** Usha Platform-logga som följer inställningen uschja-logo-lage. */
export default function UschjaLogo({ size = 64 }: { size?: number }) {
  // Deterministic initial value for SSR/first paint; the real setting is read
  // on mount (localStorage/matchMedia are client-only).
  const [mork, setMork] = useState(false);

  useEffect(() => {
    const uppdatera = () => setMork(arMork(getLogoLage()));
    uppdatera();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", uppdatera);
    window.addEventListener("uschja-logo-lage", uppdatera);
    window.addEventListener("storage", uppdatera); // synk mellan flikar
    return () => {
      mq.removeEventListener("change", uppdatera);
      window.removeEventListener("uschja-logo-lage", uppdatera);
      window.removeEventListener("storage", uppdatera);
    };
  }, []);

  return (
    <span role="img" aria-label="Usha Platform" style={{ display: "inline-block", width: size, height: size }}>
      <Monogram dag={!mork} />
    </span>
  );
}
