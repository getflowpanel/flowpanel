import type * as React from "react";
import { type BreadcrumbItem, Breadcrumbs } from "./Breadcrumbs";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} className="mb-2" />
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-fp-text-1">
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-fp-text-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
