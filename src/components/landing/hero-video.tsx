"use client";

import { useEffect, useState } from "react";

/**
 * Hero-videon är dekor. I mobilen vägde den 2 MB och laddades före varje
 * bild och allt skript, så det första en besökare från Instagram såg var en
 * tom yta. Nu renderas den bara på skärmar från 640 px och bara när
 * besökaren inte bett om mindre rörelse; på mobil tar texten plats direkt.
 * Filen är dessutom omkodad till 960 px (331 kB), vilket räcker för en
 * ruta som aldrig är bredare än 768 px.
 *
 * Rutan finns i serverns HTML (dold under 640 px, dold vid reduced-motion)
 * med videons proportioner, och videon monteras i den efter hydreringen.
 * I första versionen saknades rutan: videon sköts in efteråt och knuffade
 * ner allt under sig — CLS 0,23 på desktop enligt Speed Insights.
 */
export function HeroVideo() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 640px) and (prefers-reduced-motion: no-preference)"
    );
    const update = () => setPlay(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="animate-fade-up delay-150 mx-auto mb-8 hidden max-h-[44vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] sm:mb-10 sm:block sm:rounded-2xl motion-reduce:hidden"
      style={{ opacity: 0, aspectRatio: "16 / 9" }}
      aria-hidden="true"
    >
      {play && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
