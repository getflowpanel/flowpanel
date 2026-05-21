import { cookies } from "next/headers";
import { ADAPTER_COOKIE, type Adapter, DEFAULT_ADAPTER, isAdapter } from "@/shared/lib/adapter";

/**
 * Server-only: resolve the active adapter for this request.
 *
 * Order of precedence (highest first):
 *   1. The `flowpanel-adapter` cookie if set to a known value.
 *   2. DEFAULT_ADAPTER (prisma).
 *
 * URL-param override (`?adapter=drizzle`) is handled at the page boundary,
 * not here — it would short-circuit caching for layouts otherwise.
 */
export async function readAdapterCookie(): Promise<Adapter> {
  const store = await cookies();
  const value = store.get(ADAPTER_COOKIE)?.value;
  return isAdapter(value) ? value : DEFAULT_ADAPTER;
}
