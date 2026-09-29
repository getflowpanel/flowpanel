import type { ReactNode } from "react";
import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
