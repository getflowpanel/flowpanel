/**
 * Next's deployment `basePath`, as compiled into both bundles. Link and the
 * router prefix it for you; a raw `fetch` or a form `action` is not prefixed, so
 * anything the browser requests by itself has to add it.
 *
 * There is no public accessor for the value, and the constant is internal to
 * Next — `packages/next/src/__tests__/deployment-base.test.ts` pins the coupling
 * against the installed release. Outside Next the variable is unset and every
 * path is returned unchanged.
 */
function deploymentBasePath(): string {
  const base = process.env.__NEXT_ROUTER_BASEPATH ?? "";
  // A basePath is always rooted; anything else is an unset or mangled value.
  return base.startsWith("/") && base !== "/" ? base : "";
}

/**
 * Prefix an app-relative path for a request the browser makes on its own. The
 * path must be app-relative — `paths.api` always is. A value that already carries
 * the prefix cannot be told apart from an app-relative path that merely starts
 * with the same segment, such as `basePath: "/admin"` with `paths.api:
 * "/admin/api"`, so this never tries to guess.
 */
export function withDeploymentBasePath(path: string): string {
  const base = deploymentBasePath();
  if (base === "" || !path.startsWith("/")) return path;
  return `${base}${path}`;
}
