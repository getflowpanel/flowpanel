import type { WidgetContext } from "@flowpanel/core";
import type { ReactNode } from "react";
import { clearFiltersHref } from "./dashboard-filters";

/** An empty card's text while dashboard filters are set: why it is empty, and the way out. */
export function filteredEmptyState(ctx: WidgetContext): ReactNode | undefined {
  if (Object.keys(ctx.filters).length === 0) return undefined;
  return (
    <span data-fp-filtered="">
      {ctx.labels.widget.filtered}{" "}
      <a
        href={clearFiltersHref(ctx)}
        className="text-fp-text-2 underline-offset-4 hover:text-fp-text-1 hover:underline"
      >
        {ctx.labels.filters.clear}
      </a>
    </span>
  );
}
