export const DEMO_ROLE_COOKIE = "flowpanel-demo-role";
export type DemoRole = "admin" | "support";

/** Allow-list the unsigned persona cookie used only by this public sandbox. */
export function resolveDemoRole(cookieHeader: string | null): DemoRole {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEMO_ROLE_COOKIE}=`))
    ?.slice(DEMO_ROLE_COOKIE.length + 1);
  return value === "support" ? "support" : "admin";
}
