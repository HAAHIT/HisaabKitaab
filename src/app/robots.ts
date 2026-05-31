import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solobooks.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/guides/", "/privacy", "/terms", "/login", "/register"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/bills/",
          "/parties/",
          "/payments/",
          "/reports/",
          "/settings/",
          "/measurements/",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
