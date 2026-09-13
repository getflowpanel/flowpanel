import type * as React from "react";
import { type BadgeTone, DefaultBadge } from "../_atoms/BadgeDefault";
import { type BreadcrumbItem, Breadcrumbs } from "./Breadcrumbs";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  /** Status pill beside the title. */
  badge?: { label: string; tone?: BadgeTone };
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  const tone = badge?.tone ?? "default";
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} className="mb-2" />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-fp-text-1">
              {title}
            </h1>
            {badge ? (
              <DefaultBadge tone={tone} data-tone={tone}>
                {badge.label}
              </DefaultBadge>
            ) : null}
          </div>
          {description ? <p className="mt-1 text-sm text-fp-text-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
