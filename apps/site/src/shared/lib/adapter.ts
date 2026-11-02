export type Adapter = "prisma" | "drizzle";

export const ADAPTERS: ReadonlyArray<Adapter> = ["prisma", "drizzle"];

/** Name of the cookie that stores the active adapter. */
export const ADAPTER_COOKIE = "flowpanel-adapter";

/** Default adapter when no cookie or query param is present. */
export const DEFAULT_ADAPTER: Adapter = "prisma";

export function isAdapter(value: string | undefined | null): value is Adapter {
  return value === "prisma" || value === "drizzle";
}
