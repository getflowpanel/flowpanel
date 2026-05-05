import type { ActionResult } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { publish, publishResource } from "./publish.js";

export interface ApplyActionResultOptions {
  /**
   * When set, a `refresh: true` result triggers
   *   publishResource(resourceName, { action: "update" })
   * to fan out via SSE. Leave unset for non-resource actions.
   */
  resourceName?: string;
  /**
   * When set (and `refresh` is not explicitly `false`), invokes
   * `revalidatePath(pathname)` so the current list/detail re-renders.
   */
  pathname?: string;
}

/**
 * Applies the side effects encoded in a successful `ActionResult`:
 *
 * - `refresh === true` + `resourceName` → publishResource(resourceName, update)
 * - `Array.isArray(refresh)` → publish(channel) per entry
 * - `refresh !== false` + `pathname` → revalidatePath(pathname)
 *
 * Download is NOT applied server-side — it's surfaced back to the client
 * in the response; see `triggerDownload` on the client.
 */
export async function applyActionResult(
  result: ActionResult,
  opts: ApplyActionResultOptions,
): Promise<void> {
  if (!result.ok) return;
  const refresh = result.refresh;

  if (refresh === true && opts.resourceName) {
    await publishResource(opts.resourceName, { action: "update" });
  } else if (Array.isArray(refresh)) {
    for (const ch of refresh) await publish(ch);
  }

  if (refresh !== false && opts.pathname) {
    revalidatePath(opts.pathname);
  }
}
