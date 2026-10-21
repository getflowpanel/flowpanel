import type { ActionResult } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { logCaught } from "./caught-error";
import { publish, publishResource } from "./publish";

export interface ApplyActionResultOptions {
  resourceName?: string;
  /** The page, or pages, whose cache the change makes stale. */
  pathname?: string | readonly string[];
  /** A change FlowPanel made itself, published on `resource.<resourceName>` whatever `refresh` says. */
  change?: { action: "create" | "update" | "delete"; id?: string };
}

/** Applies side effects from successful actions: publishes updates and revalidates the cache; failures only log. */
export async function applyActionResult(
  result: ActionResult<unknown>,
  opts: ApplyActionResultOptions,
): Promise<void> {
  if (!result.ok) return;
  const refresh = result.refresh;

  try {
    if (opts.change && opts.resourceName) {
      await publishResource(opts.resourceName, opts.change);
    } else if (refresh === true && opts.resourceName) {
      await publishResource(opts.resourceName, { action: "update" });
    } else {
      const channels =
        typeof refresh === "string" ? [refresh] : Array.isArray(refresh) ? refresh : [];
      for (const ch of channels) await publish(ch);
    }
  } catch (error) {
    logCaught("[flowpanel] realtime effect failed", error);
  }

  if (refresh === false || opts.pathname === undefined) return;
  for (const path of typeof opts.pathname === "string" ? [opts.pathname] : opts.pathname) {
    try {
      revalidatePath(path);
    } catch (error) {
      logCaught("[flowpanel] revalidation effect failed", error);
    }
  }
}
