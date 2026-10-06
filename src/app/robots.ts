import type { MetadataRoute } from "next";

/**
 * OBS: ?ref= och ?utm_ blockeras INTE här, trots att de pekar på sidor som
 * redan finns i sitemapen. En partnerlänk delas på Facebook, och Facebooks
 * crawler respekterar robots.txt — blockeras adressen får inlägget ingen
 * förhandsvisning, vilket vore att sabotera partnerprogrammet för att spara
 * crawlbudget. Dubbletterna löses i stället av canonical, som sedan #340 finns
 * på varje indexerbar sida och pekar på adressen utan parametrar.
 */

/**
 * Privata ytor. Inget här är publikt innehåll, och flera av dem bär
 * personuppgifter: /biljett/ är någons kvitto med namn, /folj/ och
 * /data-deletion/ är engångslänkar. Listan gäller ALLA crawlers, AI-botterna
 * inkluderade — att vi vill synas i AI-svar betyder inte att gästernas
 * biljetter ska läsas.
 */
const PRIVATA_YTOR = [
  "/app/",
  "/api/",
  "/dashboard/",
  "/callback",
  "/offline",
  // Kvitton, engångslänkar och avregistreringar. De har noindex i sina
  // egna metadata också; det här sparar crawlbudget.
  "/biljett/",
  "/folj/",
  "/waitlist/",
  "/data-deletion/",
  "/onboarding",
];

/**
 * AI-crawlers släpps in medvetet (beslut av Pablo 2026-10-06).
 *
 * Skälet: "var kan jag dansa zouk i Stockholm" ställs numera lika ofta till en
 * chatt som till Google. Usha behöver bli hittad, och utan ett uttryckligt
 * tillstånd krupe de ändå på vår tystnad under `User-Agent: *`. Bättre att
 * beslutet står skrivet än att det ärvs.
 *
 * Priset är att plattformens publika innehåll används för att träna och svara.
 * Ska det ändras är det här, och i /llms.txt, det ändras.
 *
 * De som läser för svar (söker upp sidan när någon frågar) och de som läser
 * för träning står båda med. Vi skiljer inte på dem: synligheten kommer av att
 * modellen känner till oss, inte bara av att den slår upp oss just då.
 */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI, träning
  "OAI-SearchBot", // OpenAI, sökning i ChatGPT
  "ChatGPT-User", // OpenAI, hämtar en länk en användare bett om
  "ClaudeBot", // Anthropic, träning
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot", // Perplexity, sökning
  "Perplexity-User",
  "Google-Extended", // Googles AI-produkter (separat från Googlebot)
  "Applebot-Extended", // Apple Intelligence
  "CCBot", // Common Crawl, som i sin tur matar många modeller
  "Bytespider",
  "Amazonbot",
  "meta-externalagent", // Metas AI
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "Timpibot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATA_YTOR,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: PRIVATA_YTOR,
      },
    ],
    sitemap: "https://usha.se/sitemap.xml",
    host: "https://usha.se",
  };
}
