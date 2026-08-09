/**
 * First URL segments the admin's own routing claims before it ever looks at a
 * resource or queue name. `drawer` and `dashboards` are matched positionally by
 * the `handlers()` catch-all; `queues` is matched by the page router.
 */
export const RESERVED_ROUTE_SEGMENTS: readonly string[] = ["dashboards", "drawer", "queues"];

const LIST = RESERVED_ROUTE_SEGMENTS.map((s) => `"${s}"`).join(", ");

/** `null` when the name is free, otherwise the error text explaining the clash. */
export function reservedNameError(
  kind: "resource" | "queue",
  name: string,
  optionPath: string,
): string | null {
  if (!RESERVED_ROUTE_SEGMENTS.includes(name)) return null;
  return (
    `${kind} "${name}" uses a name FlowPanel's routing reserves (${LIST}), so its ` +
    `requests are captured by the wrong route. Set ${optionPath} to something else.`
  );
}
