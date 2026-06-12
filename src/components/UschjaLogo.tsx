"use client";

import { useEffect, useRef, useState } from "react";

/* Soltider lokalt (NOAA/suncalc) */
const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545;
const toJulian = (d: Date) => d.valueOf() / dayMs - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);

function solTider(date: Date, lat: number, lng: number) {
  const lw = -lng * rad, phi = lat * rad;
  const d = toJulian(date) - J2000;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(rad * 23.4397));
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const cosw = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosw > 1) return { polar: "natt" as const };
  if (cosw < -1) return { polar: "dag" as const };
  const w = Math.acos(cosw);
  const Jset = J2000 + 0.0009 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { rise: fromJulian(2 * Jnoon - Jset), ner: fromJulian(Jset) };
}

/* Position utan prompt: tidszon → koordinat */
const TZ: Record<string, [number, number]> = {
  "Europe/Stockholm": [59.33, 18.07], "Europe/Oslo": [59.91, 10.75],
  "Europe/Copenhagen": [55.68, 12.57], "Europe/Helsinki": [60.17, 24.94],
  "Europe/London": [51.51, -0.13], "Europe/Berlin": [52.52, 13.4],
  "Europe/Paris": [48.86, 2.35], "Europe/Madrid": [40.42, -3.7],
  "Europe/Rome": [41.9, 12.5], "Europe/Amsterdam": [52.37, 4.9],
  "America/New_York": [40.71, -74.01], "America/Los_Angeles": [34.05, -118.24],
  "Asia/Tokyo": [35.68, 139.69], "Australia/Sydney": [-33.87, 151.21],
};
function gissaPosition(): [number, number] {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ[tz]) return TZ[tz];
    return [45, (-new Date().getTimezoneOffset() / 60) * 15];
  } catch { return [59.33, 18.07]; }
}

function dagFaktorNu(lat: number, lng: number): number {
  const nu = new Date();
  const t = solTider(nu, lat, lng);
  if ("polar" in t) return t.polar === "dag" ? 1 : 0;
  const fade = 25 * 60000;
  const c = (x: number) => Math.max(0, Math.min(1, x));
  return c((+nu - +t.rise! + fade) / (2 * fade)) * (1 - c((+nu - +t.ner! + fade) / (2 * fade)));
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

/**
 * Soldriven Usch-Ja!-logga.
 * geo="ask" får bara användas i appen (där platstillstånd redan finns),
 * aldrig på landningssidan.
 */
export default function UschjaLogo({ size = 64, geo }: { size?: number; geo?: "ask" }) {
  const [[lat, lng], setPos] = useState<[number, number]>(gissaPosition);
  const [dag, setDag] = useState(() => dagFaktorNu(lat, lng));
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (geo === "ask" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setPos([p.coords.latitude, p.coords.longitude]),
        () => {}, { timeout: 5000 }
      );
    }
  }, [geo]);

  useEffect(() => {
    const tick = () => setDag(dagFaktorNu(lat, lng));
    tick();
    timer.current = setInterval(tick, 60000);
    return () => clearInterval(timer.current);
  }, [lat, lng]);

  return (
    <span role="img" aria-label="Usch-Ja!" style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, opacity: dag, transition: "opacity 1.2s ease" }}><Monogram dag /></span>
      <span style={{ position: "absolute", inset: 0, opacity: 1 - dag, transition: "opacity 1.2s ease" }}><Monogram dag={false} /></span>
    </span>
  );
}
