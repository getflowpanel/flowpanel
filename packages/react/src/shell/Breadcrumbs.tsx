import { DEFAULT_LABELS } from "@flowpanel/core/labels";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
  /** The trail's accessible name. */
  label?: string;
}

export function Breadcrumbs({
  items,
  separator,
  className,
  label = DEFAULT_LABELS.navigation.breadcrumb,
}: BreadcrumbsProps) {
  if (items.length === 0) return null;
  const sep = separator ?? <ChevronRight className="fp-h-3.5 fp-w-3.5 fp-opacity-50" />;
  return (
    <nav
      aria-label={label}
      className={cn("fp-flex fp-items-center fp-gap-1.5 fp-text-sm fp-text-faint", className)}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const key = `${i}:${it.label}`;
        return (
          <span key={key} className="fp-flex fp-items-center fp-gap-1.5">
            {it.href && !last ? (
              <a href={it.href} className="hover:fp-text-ink fp-transition-colors">
                {it.label}
              </a>
            ) : (
              <span className={last ? "fp-text-ink" : ""} aria-current={last ? "page" : undefined}>
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
