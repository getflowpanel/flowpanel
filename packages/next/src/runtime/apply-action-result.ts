import type { ActionResult, FlowpanelWarning } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { publish, publishResource } from "./publish.js";

export interface ApplyActionResultOptions {
  resourceName?: string;
  pathname?: string;
}

/** Applies side effects from successful actions: publishes updates and revalidates the cache. */
export async function applyActionResult(
  result: ActionResult<unknown>,
  opts: ApplyActionResultOptions,
): Promise<FlowpanelWarning[]> {
  if (!result.ok) return [];
  const refresh = result.refresh;
  const warnings: FlowpanelWarning[] = [];

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
    warnings.push({ code: "realtime_failed", message: "Realtime refresh could not be published." });
  }

  if (refresh !== false && opts.pathname) {
    try {
      revalidatePath(opts.pathname);
    } catch (error) {
      console.error("[flowpanel] revalidation effect failed", error);
      warnings.push({
        code: "revalidation_failed",
        message: "Cached views could not be refreshed.",
      });
    }
  }
  return warnings;
}
