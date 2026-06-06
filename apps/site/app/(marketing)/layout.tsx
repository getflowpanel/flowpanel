import type { ReactNode } from "react";
import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";

/**
 * Marketing surface — no docs shell. The header and footer are shared by
 * every marketing route (landing, changelog), so they live here; each page
 * supplies only its own <main>.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
