import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Events, hosting and sponsorship are sections of the same public page.
  return [{ url: siteUrl }];
}
