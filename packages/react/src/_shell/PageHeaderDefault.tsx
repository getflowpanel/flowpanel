import type * as React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs.js";

export interface PageHeaderProps {
  title: string;
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
        <div>
          <h1 className="text-xl font-semibold text-fp-text-1">{title}</h1>
          {description ? <p className="mt-1 text-sm text-fp-text-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
