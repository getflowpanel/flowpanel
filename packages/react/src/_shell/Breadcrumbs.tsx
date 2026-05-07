import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

export function Breadcrumbs({ items, separator, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  const sep = separator ?? <ChevronRight className="h-3.5 w-3.5 opacity-50" />;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-sm text-fp-text-3 ${className ?? ""}`}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const key = `${i}:${it.label}`;
        return (
          <span key={key} className="flex items-center gap-1.5">
            {it.href && !last ? (
              <a href={it.href} className="hover:text-fp-text-1 transition-colors">
                {it.label}
              </a>
            ) : (
              <span
                className={last ? "text-fp-text-1" : ""}
                aria-current={last ? "page" : undefined}
              >
                {it.label}
              </span>
            )}
            {last ? null : <span aria-hidden>{sep}</span>}
          </span>
        );
      })}
    </nav>
  );
}
