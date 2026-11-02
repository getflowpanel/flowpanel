import type { MetadataRoute } from "next";
import { siteConfig } from "@/shared/lib/site-config";
import { source } from "@/shared/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source.getPages().map((page) => ({ url: `${siteConfig.url}${page.url}` }));
  return [{ url: siteConfig.url }, { url: `${siteConfig.url}/changelog` }, ...docs];
}
