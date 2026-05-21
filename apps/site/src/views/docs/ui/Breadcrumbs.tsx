import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Top-of-page crumb trail: flowpanel / Docs / Section / Current page.
 * The last item is treated as the current page (not linked).
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const all: BreadcrumbItem[] = [
    { label: siteConfig.name, href: "/" },
    { label: "Docs", href: "/docs" },
    ...items,
  ];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 font-mono text-sm text-[var(--color-fg-muted)]">
        {all.map((item, index) => {
          const isLast = index === all.length - 1;
          return (
            <li key={item.href ?? `crumb:${item.label}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="underline-offset-4 transition-colors hover:text-[var(--color-fg)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-[var(--color-fg)]" : undefined}>{item.label}</span>
              )}
              {!isLast ? (
                <ChevronRight aria-hidden className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
