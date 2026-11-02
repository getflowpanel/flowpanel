import type {
  DetailBadge,
  DetailHeaderContext,
  DetailOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  Tone,
  WidgetContext,
} from "@flowpanel/core";
import type { ReactNode } from "react";
import { declaredTitle } from "../../runtime/declared-title";
import { labelValue } from "../../runtime/record-label";
import { resolveLink } from "../../runtime/resolve-link";
import { singularLabel } from "../../runtime/resource-title";
import { rowKeyOf } from "../../runtime/row-identity";

type Row = Record<string, unknown>;
type Pill = { label: string; tone?: Tone; href?: string };

export interface RecordHeader {
  title: ReactNode;
  subtitle?: string;
  badges: Pill[];
}

/** The row's name, title or email, else "Customer · 52": what a record is called when `detail.title` says nothing. */
export function fallbackTitle(resource: ResourceConfig, name: string, row: Row): string {
  const pk = rowKeyOf(resource);
  const label = singularLabel(resource, name);
  return labelValue(row) ?? (row[pk] === undefined ? label : `${label} · ${String(row[pk])}`);
}

/** A nullish `title` falls back to the row's name, title or email, then to label · key. */
export async function recordHeader(
  resource: ResourceConfig,
  name: string,
  id: string,
  row: Row,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<RecordHeader> {
  const detail = resource.options.detail as DetailOptions<Row> | undefined;
  const fallback = fallbackTitle(resource, name, row);
  const headerCtx: DetailHeaderContext = { format: ctx.format, labels: ctx.labels, link: ctx.link };
  const [declared, subtitle, badge] = await Promise.all([
    declaredTitle(config, resource, id, reqCtx, row, headerCtx),
    detail?.subtitle?.(row, headerCtx),
    detail?.badge?.(row, headerCtx),
  ]);
  const listed = (Array.isArray(badge) ? badge : [badge]).filter(
    (entry): entry is DetailBadge => entry !== null && entry !== undefined,
  );
  const badges = listed.map((entry) => {
    const href = entry.href === undefined ? undefined : resolveLink(config, ctx, entry.href);
    return {
      label: entry.label,
      ...(entry.tone ? { tone: entry.tone } : {}),
      ...(href ? { href } : {}),
    };
  });
  return { title: declared ?? fallback, ...(subtitle ? { subtitle } : {}), badges };
}

/** One plain badge as 0.3.0 passed it, else the list, so a themed header keeps working. */
export function headerBadges(badges: Pill[]): { badge?: Pill; badges?: Pill[] } {
  const [only] = badges;
  if (!only) return {};
  return badges.length === 1 && only.href === undefined ? { badge: only } : { badges };
}
