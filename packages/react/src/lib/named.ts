/** Sets `displayName` inside a call a bundler can drop when the component goes unused. */
export function named<T extends object>(
  component: T,
  source: string | { displayName?: string | undefined },
): T {
  (component as { displayName?: string | undefined }).displayName =
    typeof source === "string" ? source : source.displayName;
  return component;
}
