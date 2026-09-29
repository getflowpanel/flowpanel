import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/shared/lib/source";

export const { GET } = createFromSource(source);
