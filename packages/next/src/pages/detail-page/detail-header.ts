import type {
  DetailBadge,
  DetailHeaderContext,
  DetailOptions,
  ResolvedAdminConfig,
  ResourceConfig,
  Tone,
  WidgetContext,
} from "@flowpanel/core";
import type { ReactNode } from "react";
import { DEFAULT_RESOURCE_ROW_KEY } from "../../runtime/defaults";
import { resolveLink } from "../../runtime/resolve-link";
import { singularLabel } from "../../runtime/resource-title";

type Row = Record<string, unknown>;
type Pill = { label: string; tone?: Tone; href?: string };

export interface RecordHeader {
  title: ReactNode;
  subtitle?: string;
  badges: Pill[];
}

/** `title` wins over the deprecated `header`; nullish output falls back to label · key. */
export async function recordHeader(
  resource: ResourceConfig,
  name: string,
  row: Row,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): Promise<RecordHeader> {
  const detail = resource.options.detail as DetailOptions<Row> | undefined;
  const pk = (resource.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
  const label = singularLabel(resource, name);
  const fallback = row[pk] === undefined ? label : `${label} · ${String(row[pk])}`;
  const headerCtx: DetailHeaderContext = { format: ctx.format, labels: ctx.labels, link: ctx.link };
  const [declared, subtitle, badge] = await Promise.all([
    detail?.title ? detail.title(row, headerCtx) : detail?.header?.(row),
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
