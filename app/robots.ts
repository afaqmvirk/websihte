import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal", "/api/portal"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
