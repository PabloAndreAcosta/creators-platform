import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private/app surfaces that hold no indexable public content.
        disallow: [
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
          // Partnerlänkar och kampanjspårning pekar på sidor som redan finns i
          // sitemapen. Utan den här raden crawlas samma sida en gång per kod.
          "/*?ref=",
          "/*?utm_",
        ],
      },
    ],
    sitemap: "https://usha.se/sitemap.xml",
    host: "https://usha.se",
  };
}
