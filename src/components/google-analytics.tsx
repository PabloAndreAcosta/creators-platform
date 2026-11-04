import Script from "next/script";
import { CONSENT_COOKIE, CONSENT_DEFAULTS } from "@/lib/consent";

/**
 * Google Analytics 4 i samtyckesläge.
 *
 * Ordningen spelar roll: samtyckets standardläge (allt nekat) måste ligga i
 * dataLayer före config, annars hinner GA sätta cookies innan något val finns.
 * Har besökaren redan godkänt statistik (cookien usha_consent=granted) slås det
 * på direkt, före första sidvisningen. Se src/lib/consent.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', ${JSON.stringify(CONSENT_DEFAULTS)});
        if (/(?:^|;\\s*)${CONSENT_COOKIE}=granted(?:;|$)/.test(document.cookie)) {
          gtag('consent', 'update', { analytics_storage: 'granted' });
        }
        gtag('js', new Date());
        gtag('config', '${id}');
      `}</Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
    </>
  );
}
