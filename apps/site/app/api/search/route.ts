import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/shared/lib/source";

/**
 * Orama-backed search endpoint. Fumadocs's RootProvider discovers
 * `/api/search` automatically; the SearchDialog calls it with the
 * user's query and renders the typed result.
 *
 * The index lives in memory on the server — no external dependency.
 */
export const { GET } = createFromSource(source);
