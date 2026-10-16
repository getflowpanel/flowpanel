import type * as React from "react";
import { type BadgeTone, DefaultBadge } from "../atoms/BadgeDefault";
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
  /** The breadcrumb trail's accessible name — injected by `PageHeader` from the labels. */
  breadcrumbLabel?: string;
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
      className="-fp-my-px fp-inline-flex fp-rounded-full fp-py-px hover:fp-opacity-80 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
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
  breadcrumbLabel,
}: PageHeaderProps) {
  const pills: Pill[] = badges ?? (badge ? [badge] : []);
  return (
    <header className="fp-mb-6">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs
          items={breadcrumbs}
          className="fp-mb-2"
          {...(breadcrumbLabel ? { label: breadcrumbLabel } : {})}
        />
      ) : null}
      <div className="fp-flex fp-flex-wrap fp-items-start fp-justify-between fp-gap-x-4 fp-gap-y-2">
        <div className="fp-min-w-0">
          <div className="fp-flex fp-flex-wrap fp-items-center fp-gap-2">
            <h1 className="fp-break-words fp-text-2xl fp-font-semibold fp-tracking-tight fp-text-ink">
              {title}
            </h1>
            {pills.map((pill, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: badges are ordered and labels may repeat
              <HeaderPill key={index} {...pill} />
            ))}
          </div>
          {description ? <p className="fp-mt-1 fp-text-sm fp-text-faint">{description}</p> : null}
        </div>
        {actions ? (
          // As tall as the title's line, so the actions centre on the title, not on the block under it.
          <div className="fp-flex fp-shrink-0 fp-items-center fp-gap-2 sm:fp-h-8">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
