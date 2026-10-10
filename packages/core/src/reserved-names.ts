import { FlowpanelConfigError } from "./types/config-error";

/** First URL segments the admin's own routing claims before it ever looks at a resource or queue name. */
export const RESERVED_ROUTE_SEGMENTS: readonly string[] = ["dashboards", "drawer", "queues"];

const LIST = RESERVED_ROUTE_SEGMENTS.map((s) => `"${s}"`).join(", ");

/** Throws when `name` is one of the route segments the admin claims for itself. */
export function assertNotReservedName(
  kind: "resource" | "queue",
  name: string,
  optionPath: string,
): void {
  if (!RESERVED_ROUTE_SEGMENTS.includes(name)) return;
  throw new FlowpanelConfigError(
    `${kind} "${name}"`,
    `the name is one FlowPanel's routing reserves (${LIST}), so its requests would reach the ` +
      `wrong route. Set ${optionPath} to another name.`,
  );
}
