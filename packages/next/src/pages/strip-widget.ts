import type { WidgetConfig } from "@flowpanel/core";
import { warnOnce } from "../runtime/widget-reads";

/** Whether a strip draws `widget` as a plain cell; another kind warns once and keeps its card. */
export function stripWidget(widget: WidgetConfig, where: string, section: number): boolean {
  if (widget.kind === "metric" || widget.kind === "stat") return true;
  warnOnce(
    `strip:${where}:${section}:${widget.kind}`,
    `${where} section ${section} is a strip, which draws metric and stat widgets; ` +
      `a ${widget.kind} widget renders as its own card there.`,
  );
  return false;
}
