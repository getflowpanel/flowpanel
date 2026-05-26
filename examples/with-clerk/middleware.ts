import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk's recommended middleware. It populates the `auth()` helper so
 * `withClerk()` in `flowpanel.config.ts` can resolve the current session
 * without per-request wiring.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API + tRPC routes.
    "/(api|trpc)(.*)",
  ],
};
