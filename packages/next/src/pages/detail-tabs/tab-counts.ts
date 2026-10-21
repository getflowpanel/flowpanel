import { type DetailTab, formatLabel, type WidgetContext } from "@flowpanel/core";
import { logCaught } from "../../runtime/caught-error";

type Row = Record<string, unknown>;

/** Each counted tab's label with its row count; a failed count keeps the plain label. */
export async function tabCountLabels(
  ctx: WidgetContext,
  row: Row,
  tabs: readonly DetailTab<Row>[],
): Promise<Map<string, string>> {
  const counted = tabs.filter((tab) => tab.count === true && typeof tab.resource === "string");
  const labels = await Promise.all(
    counted.map(async (tab) => {
      try {
        const n = await ctx.count(String(tab.resource), tab.filter ? tab.filter(row) : {});
        const label = formatLabel(ctx.labels.detail.tabCount, {
          label: tab.label,
          count: ctx.format.number(n),
        });
        return [tab.key, label] as const;
      } catch (cause) {
        logCaught(`[flowpanel] count for tab "${tab.key}" failed`, cause);
        return [tab.key, tab.label] as const;
      }
    }),
  );
  return new Map(labels);
}
