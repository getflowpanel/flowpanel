import type { ReactNode } from "react";

/**
 * Marketing surface — no docs shell. Header/footer live inside each page
 * for now; once components/layout/header.tsx exists in phase 1, lift them
 * here.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-[var(--color-bg)]">{children}</div>;
}
