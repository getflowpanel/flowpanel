import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { BreadcrumbItem } from "./Breadcrumbs";
import { PageHeader } from "./PageHeader";

export interface DetailShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DetailShell({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className,
}: DetailShellProps) {
  return (
    <div className={cn("fp-p-6", className)}>
      <PageHeader
        title={title}
        {...(subtitle ? { description: subtitle } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(actions ? { actions } : {})}
      />
      <div className="fp-mt-6 fp-space-y-6">{children}</div>
    </div>
  );
}
