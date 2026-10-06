// Next's deployment basePath: Link and the router add it themselves, a raw fetch or form action has to add it.
function deploymentBasePath(): string {
  const base = process.env.__NEXT_ROUTER_BASEPATH ?? "";
  // A basePath is always rooted; anything else is an unset or mangled value.
  return base.startsWith("/") && base !== "/" ? base : "";
}

/**
 * Prefixes an app-relative path for a request the browser makes on its own; the path must be app-relative.
 * Never guesses: an already-prefixed value can look identical to one that merely starts with the same segment.
 */
export function withDeploymentBasePath(path: string): string {
  const base = deploymentBasePath();
  if (base === "" || !path.startsWith("/")) return path;
  return `${base}${path}`;
}
