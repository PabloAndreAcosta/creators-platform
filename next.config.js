const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Usha Games (Skuggspelet) bor på en egen domän sedan 2026-10-27: ushagames.se,
// en Cloudflare Worker. usha.se/spel och usha.se/games skickar vidare dit, så att
// gamla länkar och QR-koder fortsätter fungera. Repo: usha-ab/skuggspelet.
const USHA_GAMES_ORIGIN = process.env.USHA_GAMES_ORIGIN || "https://ushagames.se";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Kort adress till registreringen, för ytor där en query-sträng inte går
      // att läsa: projicerad på en vägg, uppläst i en story, tryckt på ett
      // flygblad. "usha.se/signup?role=customer" fungerar men går inte att säga
      // högt.
      //
      // permanent: false (307) med flit. En 308 cachas av webbläsaren i
      // praktiken för alltid, och den här adressen ska kunna peka någon
      // annanstans den dag välkomstavdraget ändras eller tas bort — annars
      // sitter besökare fast på ett erbjudande som inte finns.
      //
      // Redirects körs före routingen, så /join vinner över [slug] (kreatörernas
      // egna adresser) utan att någon av dem behöver veta om den andra.
      // Medvärdar skriver "samarbeten" — sidan heter my-collaborations.
      { source: "/app/samarbeten", destination: "/app/my-collaborations", permanent: false },
      { source: "/samarbeten", destination: "/app/my-collaborations", permanent: false },
      { source: "/join", destination: "/signup?role=customer", permanent: false },
      { source: "/konto", destination: "/signup?role=customer", permanent: false },
      { source: "/konto/insta", destination: "/signup?role=customer&utm_source=instagram&utm_medium=social&utm_campaign=konto&utm_content=reel", permanent: false },
      { source: "/konto/chatt", destination: "/signup?role=customer&utm_source=chatt&utm_medium=dm&utm_campaign=konto", permanent: false },
      // Korta rekryteringslänkar för reels och chattar. Kanalen (UTM) följer med
      // i omdirigeringen och fångas av middlewaren på målsidan, så länken som
      // delas kan vara kort och snygg. Värdena följer docs/utm-rutin.md i
      // usha-marknadsforing.
      { source: "/taxi/insta", destination: "/taxi?utm_source=instagram&utm_medium=social&utm_campaign=taxidansare&utm_content=reel", permanent: false },
      { source: "/taxi/chatt", destination: "/taxi?utm_source=chatt&utm_medium=dm&utm_campaign=taxidansare", permanent: false },
      { source: "/undervisa/insta", destination: "/undervisa?utm_source=instagram&utm_medium=social&utm_campaign=instruktor&utm_content=reel", permanent: false },
      { source: "/undervisa/chatt", destination: "/undervisa?utm_source=chatt&utm_medium=dm&utm_campaign=instruktor", permanent: false },
      // The Lab: alltid nästa torsdag (/event/the-lab-torsdag följer serien).
      { source: "/thelab", destination: "/event/the-lab-torsdag", permanent: false },
      { source: "/thelab/insta", destination: "/event/the-lab-torsdag?utm_source=instagram&utm_medium=social&utm_campaign=thelab&utm_content=reel", permanent: false },
      // Tyck till: DJ-röstningen och enkäterna. Hashen följer med till sidan.
      { source: "/dj", destination: "/tyck-till#dj", permanent: false },
      { source: "/tyck", destination: "/tyck-till", permanent: false },
      { source: "/thelab/chatt", destination: "/event/the-lab-torsdag?utm_source=chatt&utm_medium=dm&utm_campaign=thelab", permanent: false },
      // Spelen har flyttat till ushagames.se. Query-strängen (t.ex. ?vuxen eller
      // ?kod=) följer med. Redirects körs före sidorna, så /spel tolkas aldrig som
      // en kreatörs adress ([slug]). 307 av samma skäl som ovan.
      { source: "/spel", destination: `${USHA_GAMES_ORIGIN}/spel/`, permanent: false },
      { source: "/spel/:path*", destination: `${USHA_GAMES_ORIGIN}/spel/:path*`, permanent: false },
      { source: "/games", destination: `${USHA_GAMES_ORIGIN}/spel/`, permanent: false },
      { source: "/games/:path*", destination: `${USHA_GAMES_ORIGIN}/spel/:path*`, permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://usha.se" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
          // API responses are per-user/authenticated — never let a shared or
          // browser cache store them (the framework default was
          // "public, max-age=0, must-revalidate", which served stale balances
          // and could serve one user's data to another).
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Reporting endpoint for the Report-Only CSP below (modern Reporting API).
          { key: "Reporting-Endpoints", value: 'csp-endpoint="https://usha.se/api/csp-report"' },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self), payment=(self), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com https://*.signicat.com https://usha-ab.app.signicat.com",
          },
          {
            // Full policy in Report-Only first — monitor for violations, then
            // promote to an enforced Content-Security-Policy.
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://maps.googleapis.com https://js.stripe.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.supabase.co https://auth.usha.se https://images.unsplash.com https://*.cdninstagram.com https://*.fbcdn.net https://*.tiktokcdn.com https://www.googletagmanager.com https://*.googleapis.com https://*.gstatic.com https://*.google-analytics.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://auth.usha.se wss://auth.usha.se https://maps.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://api.stripe.com https://api.signicat.com https://vitals.vercel-insights.com",
              "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://*.signicat.com",
              "media-src 'self'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com https://*.signicat.com https://usha-ab.app.signicat.com",
              // Collect violations so we can review before promoting to enforced.
              // report-uri = legacy/broadest support; report-to = modern Reporting API.
              "report-uri /api/csp-report",
              "report-to csp-endpoint",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        // Supabase via egen domän (Custom Domain) — samma lagring, ny adress.
        protocol: "https",
        hostname: "auth.usha.se",
      },
      {
        // Google-inloggade kreatörers profilbilder (profiles.avatar_url).
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // Reservbilden på eventsidan när annonsen saknar egen bild.
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "**.tiktokcdn.com",
      },
    ],
  },
};

let exported = withNextIntl(nextConfig);

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require("@sentry/nextjs");
  exported = withSentryConfig(exported, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    disableLogger: true,
    automaticVercelMonitors: false,
  });
}

module.exports = exported;
