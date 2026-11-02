import type { RequestContext, WidgetConfig } from "@flowpanel/core";
import { accessAllows } from "@flowpanel/core";

/** The widgets whose `access` admits the caller, in order. */
export async function visibleWidgets<W extends WidgetConfig>(
  widgets: readonly W[],
  reqCtx: RequestContext,
): Promise<W[]> {
  const allowed = await Promise.all(
    widgets.map((widget) => accessAllows(widget.options.access, reqCtx)),
  );
  return widgets.filter((_, index) => allowed[index]);
}
