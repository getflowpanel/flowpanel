import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

/**
 * Single entry point for the docs page tree and lookups.
 * Used by app/(content)/docs/[[...slug]]/page.tsx, sidebar, search, sitemap.
 */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export type Page = ReturnType<typeof source.getPage>;
