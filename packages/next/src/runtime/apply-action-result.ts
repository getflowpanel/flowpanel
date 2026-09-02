import type { ActionResult } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { publish, publishResource } from "./publish";

export interface ApplyActionResultOptions {
  resourceName?: string;
  pathname?: string;
}

/**
 * Applies side effects from successful actions: publishes updates and
 * revalidates the cache. Failures are logged, never thrown — the mutation
 * itself already succeeded.
 */
export async function applyActionResult(
  result: ActionResult<unknown>,
  opts: ApplyActionResultOptions,
): Promise<void> {
  if (!result.ok) return;
  const refresh = result.refresh;

  try {
    if (refresh === true && opts.resourceName) {
      await publishResource(opts.resourceName, { action: "update" });
    } else {
      const channels =
        typeof refresh === "string" ? [refresh] : Array.isArray(refresh) ? refresh : [];
      for (const ch of channels) await publish(ch);
    }
  } catch (error) {
    console.error("[flowpanel] realtime effect failed", error);
  }

  if (refresh !== false && opts.pathname) {
    try {
      revalidatePath(opts.pathname);
    } catch (error) {
      console.error("[flowpanel] revalidation effect failed", error);
    }
  }
}
