import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private areas (also protected by authentication and noindex).
      disallow: ["/api/", "/*/admin", "/*/dashboard", "/*/mfa", "/*/update-password", "/*/auth/"],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
