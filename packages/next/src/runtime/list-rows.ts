import type {
  ListRow,
  ListWidget,
  ResolvedAdminConfig,
  Tone,
  WidgetContext,
} from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core";
import type { ListCardRow } from "@flowpanel/react";
import { linkRows, resolveLink } from "./resolve-link";

const SEVERITY: Partial<Record<Tone, number>> = { err: 3, warn: 2, info: 1 };
const severity = (row: ListRow): number => SEVERITY[row.tone ?? "default"] ?? 0;

/** A `list()` or `banner()` card's data: rows in order, counts and ages as text, the rest folded. */
export interface ListCardData {
  label?: string;
  rows: ListCardRow[];
  variant?: "banner";
  allClear?: string;
  more?: { text: string; href?: string };
  emptyState: string;
}

export async function listCardData(
  widget: ListWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): Promise<ListCardData> {
  const options = widget.options;
  const isBanner = options.variant === "banner";
  const queried = await options.query(ctx);
  const ordered = isBanner
    ? [...queried].sort((a, b) => severity(b) - severity(a) || (b.count ?? 0) - (a.count ?? 0))
    : queried;
  const shown =
    options.limit !== undefined && options.limit >= 0 ? ordered.slice(0, options.limit) : ordered;
  const hidden = ordered.length - shown.length;
  const moreHref = hidden > 0 ? resolveLink(config, ctx, options.more) : undefined;
  return {
    ...(options.label ? { label: options.label } : {}),
    rows: linkRows(config, ctx, shown).map(({ count, since, ...row }) => ({
      ...row,
      ...(count !== undefined ? { count: ctx.format.number(count) } : {}),
      ...(since !== undefined ? { since: ctx.format.relative(since) } : {}),
    })),
    ...(isBanner
      ? { variant: "banner" as const, allClear: options.allClear ?? ctx.labels.widget.allClear }
      : {}),
    ...(hidden > 0
      ? {
          more: {
            text: formatLabel(ctx.labels.widget.more, { n: ctx.format.number(hidden) }),
            ...(moreHref ? { href: moreHref } : {}),
          },
        }
      : {}),
    emptyState: options.emptyState ?? ctx.labels.widget.empty,
  };
}
