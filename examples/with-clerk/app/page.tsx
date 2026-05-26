import { SignedIn, SignedOut, SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

// Clerk reads its publishable key from process.env at render time, so this
// page must run dynamically per request (not be prerendered at build time).
export const dynamic = "force-dynamic";

/**
 * Landing page: redirect signed-in users to /admin (where FlowPanel's
 * `withClerk({ requireRole: "admin" })` will further gate on role), and show
 * Clerk's <SignIn> widget to everyone else.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-10">
      <SignedIn>{redirect("/admin")}</SignedIn>
      <SignedOut>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">FlowPanel + Clerk</h1>
          <p className="mt-1 text-sm text-fp-text-2">Sign in to open the admin.</p>
        </div>
        <SignIn routing="hash" />
      </SignedOut>
    </main>
  );
}
