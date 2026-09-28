import { isDone } from "../internal/checklist-rows";
import type { ResourceName } from "../types/registry";
import type {
  ChecklistItem,
  ChecklistOptions,
  ChecklistWidget,
  HeatmapOptions,
  HeatmapWidget,
} from "../types/widget-activity";

/** How often, day by day, over the last `days` days; `source` fields are checked against its row. */
export function heatmap<N extends ResourceName>(options: HeatmapOptions<N>): HeatmapWidget {
  return { kind: "heatmap", options: options as HeatmapOptions };
}

/** What is done and what is not, with a summary, and — when `ordered` — each step's date and gap. */
export function checklist(options: ChecklistOptions): ChecklistWidget {
  return { kind: "checklist", options };
}

/** One checklist item per labelled field of `row`, done when the field holds a value; `0` counts. */
export function filled<R extends Record<string, unknown>>(
  row: R | null | undefined,
  labels: Partial<Record<keyof R & string, string>>,
): ChecklistItem[] {
  return Object.entries(labels).flatMap(([field, label]) =>
    typeof label === "string" ? [{ label, done: isDone(row?.[field]) }] : [],
  );
}
