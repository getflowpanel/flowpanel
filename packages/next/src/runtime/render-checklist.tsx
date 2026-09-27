import {
  type ChecklistWidget,
  formatLabel,
  type ResolvedAdminConfig,
  type WidgetContext,
} from "@flowpanel/core";
import { checklistRows } from "@flowpanel/core/internal";
import { ChecklistCard, type ChecklistCardItem } from "@flowpanel/react";
import type { ReactNode } from "react";
import { filteredEmptyState } from "./filtered-empty";
import { resolveLink } from "./resolve-link";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";

/** A `checklist()` card: marks, dates and gaps when ordered, and the summary of required items. */
export async function renderChecklist(
  widget: ChecklistWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const options = widget.options;
  const [items, captionLine] = await Promise.all([
    typeof options.items === "function" ? options.items(ctx) : options.items,
    caption,
  ]);
  const { rows, done, total } = checklistRows(
    items,
    options.ordered === true,
    ctx.dateRange.timeZone,
  );
  const labels = ctx.labels.checklist;
  const cards = rows.map((row, index): ChecklistCardItem => {
    const href = row.href === undefined ? undefined : resolveLink(config, ctx, row.href);
    const date =
      row.day !== null
        ? ctx.format.date(row.day)
        : row.at !== null
          ? ctx.format.dateTime(row.at)
          : undefined;
    return {
      key: `${index}:${row.label}`,
      label: row.label,
      state: row.state,
      mark: labels[row.state],
      ...(row.hint ? { hint: row.hint } : {}),
      ...(row.tone ? { tone: row.tone } : {}),
      ...(href ? { href } : {}),
      ...(date ? { date } : {}),
      ...(row.gapMs !== null
        ? { gap: formatLabel(labels.gap, { duration: ctx.format.duration(row.gapMs) }) }
        : {}),
    };
  });
  const summary =
    options.summary !== false && total > 0
      ? {
          text: formatLabel(labels.summary, {
            done: ctx.format.number(done),
            total: ctx.format.number(total),
          }),
          share: done / total,
        }
      : undefined;
  return (
    <ChecklistCard
      {...(options.label ? { label: options.label } : {})}
      items={cards}
      layout={options.layout ?? "list"}
      {...(summary ? { summary } : {})}
      emptyState={filteredEmptyState(ctx) ?? options.emptyState ?? ctx.labels.widget.empty}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
