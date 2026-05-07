import type { ReactNode } from "react";
import type { BreadcrumbItem } from "./Breadcrumbs.js";
import { PageHeader } from "./PageHeader.js";

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
    <div className={`p-6 ${className ?? ""}`}>
      <PageHeader
        title={title}
        {...(subtitle ? { description: subtitle } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(actions ? { actions } : {})}
      />
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
