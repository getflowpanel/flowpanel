import { SignedOut, SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Landing page: redirect signed-in users to /admin (where FlowPanel's
 * `withClerk({ requireRole: "admin" })` will further gate on role), and show
 * Clerk's <SignIn> widget to everyone else.
 */
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-10">
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
