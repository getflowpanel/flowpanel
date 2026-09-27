import type * as React from "react";
import { type BadgeTone, DefaultBadge } from "../_atoms/BadgeDefault";
import { type BreadcrumbItem, Breadcrumbs } from "./Breadcrumbs";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  /** Status pill beside the title. */
  badge?: { label: string; tone?: BadgeTone };
  /** Several pills, in order; wins over `badge`. A pill with `href` is a link. */
  badges?: Array<{ label: string; tone?: BadgeTone; href?: string }>;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

type Pill = NonNullable<PageHeaderProps["badges"]>[number];

function HeaderPill({ label, tone = "default", href }: Pill) {
  const badge = (
    <DefaultBadge tone={tone} data-tone={tone}>
      {label}
    </DefaultBadge>
  );
  if (!href) return badge;
  return (
    <a
      href={href}
      className="rounded-full hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60"
    >
      {badge}
    </a>
  );
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPageHeader({
  title,
  description,
  badge,
  badges,
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  const pills: Pill[] = badges ?? (badge ? [badge] : []);
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
            {pills.map((pill, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: badges are ordered and labels may repeat
              <HeaderPill key={index} {...pill} />
            ))}
          </div>
          {description ? <p className="mt-1 text-sm text-fp-text-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
