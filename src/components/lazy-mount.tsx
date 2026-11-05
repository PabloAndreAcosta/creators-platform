"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renderar innehållet först när platsen är på väg in i bild.
 *
 * Till för tunga inbäddningar som ligger långt ner på sidan, i första hand
 * Google Maps-kartan på eventsidan: ~330 kB skript som laddades vid start
 * trots `loading="lazy"` på iframen. Chrome börjar nämligen ladda lata
 * iframes redan när de är upp till 2 500 px under skärmkanten på långsamt
 * nät, och eventsidan är sällan längre än så. Här finns iframen inte i DOM:en
 * förrän rutan är inom `margin` från skärmen, så inget kan laddas i förtid.
 *
 * Platshållaren har samma höjd som innehållet, så sidan hoppar inte när det
 * dyker upp. Saknar webbläsaren IntersectionObserver renderas innehållet
 * direkt — samma beteende som i dag.
 */
export function LazyMount({
  children,
  margin = "400px",
  className,
}: {
  children: ReactNode;
  /** Hur långt utanför skärmen monteringen får börja (rootMargin). */
  margin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, visible]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : null}
    </div>
  );
}
