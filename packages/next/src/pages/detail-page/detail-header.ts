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

const LABEL_KEYS = ["name", "title", "email"];

function labelValue(row: Row): string | undefined {
  for (const key of LABEL_KEYS) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

/** A nullish `title` falls back to the row's name, title or email, then to label · key. */
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
  const fallback =
    labelValue(row) ?? (row[pk] === undefined ? label : `${label} · ${String(row[pk])}`);
  const headerCtx: DetailHeaderContext = { format: ctx.format, labels: ctx.labels, link: ctx.link };
  const [declared, subtitle, badge] = await Promise.all([
    detail?.title?.(row, headerCtx),
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
