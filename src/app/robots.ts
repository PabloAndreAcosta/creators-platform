import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private/app surfaces that hold no indexable public content.
        disallow: ["/app/", "/api/", "/dashboard/", "/callback", "/offline"],
      },
    ],
    sitemap: "https://usha.se/sitemap.xml",
    host: "https://usha.se",
  };
}
