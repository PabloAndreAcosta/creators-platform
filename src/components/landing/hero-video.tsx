"use client";

import { useEffect, useState } from "react";

/**
 * Hero-videon är dekor. I mobilen vägde den 2 MB och laddades före varje
 * bild och allt skript, så det första en besökare från Instagram såg var en
 * tom yta. Nu renderas den bara på skärmar från 640 px och bara när
 * besökaren inte bett om mindre rörelse; på mobil tar texten plats direkt.
 * Filen är dessutom omkodad till 960 px (331 kB), vilket räcker för en
 * ruta som aldrig är bredare än 768 px.
 */
export function HeroVideo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 640px) and (prefers-reduced-motion: no-preference)"
    );
    const update = () => setShow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!show) return null;

  return (
    <div
      className="animate-fade-up delay-150 mx-auto mb-8 max-w-3xl overflow-hidden rounded-xl border border-[var(--usha-border)] sm:mb-10 sm:rounded-2xl"
      style={{ opacity: 0 }}
    >
      {/* Höjdtaket gäller även på desktop. Utan det växte videon med
          skärmen och tryckte ned allt konkret under vikningen. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="w-full max-h-[38vh] object-cover sm:max-h-[44vh]"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
