import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "@/src/app/globals.css";

export const metadata: Metadata = {
  title: "with-clerk — FlowPanel example",
  description: "FlowPanel + Clerk auth — minimal showcase of withClerk({ requireRole: 'admin' })",
};

// Clerk reads its publishable key from process.env at render time, so we
// can't prerender any page statically. `force-dynamic` at the root layout
// cascades to all children and lets `next build` succeed without Clerk
// credentials present in the environment.
export const dynamic = "force-dynamic";

/**
 * `ClerkProvider` wraps the app so client components see the user, while
 * `clerkMiddleware()` (see `middleware.ts`) populates `auth()` for server
 * components — which is what `withClerk()` calls inside `flowpanel.config.ts`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-fp-bg-2 text-fp-text-1 antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
