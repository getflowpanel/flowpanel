import type { ResolvedLabels } from "@flowpanel/core/labels";

/** What to say when a request never reached the server: offline, or the server out of reach. */
export function connectionMessage(errors: ResolvedLabels["errors"]): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return offline ? errors.offline : errors.network;
}
