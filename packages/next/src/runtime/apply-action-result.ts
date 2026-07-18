import type { ActionResult } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { publish, publishResource } from "./publish.js";

export interface ApplyActionResultOptions {
  resourceName?: string;
  pathname?: string;
}

/** Applies side effects from successful actions: publishes updates and revalidates the cache. */
export async function applyActionResult(
  result: ActionResult,
  opts: ApplyActionResultOptions,
): Promise<void> {
  if (!result.ok) return;
  const refresh = result.refresh;

  if (refresh === true && opts.resourceName) {
    await publishResource(opts.resourceName, { action: "update" });
  } else {
    const channels =
      typeof refresh === "string" ? [refresh] : Array.isArray(refresh) ? refresh : [];
    for (const ch of channels) await publish(ch);
  }

  if (refresh !== false && opts.pathname) {
    revalidatePath(opts.pathname);
  }
}
