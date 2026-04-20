/**
 * Serializer: strips functions from resolved widgets to produce a client-safe
 * description of the dashboard layout.
 */

import type { ResolvedWidget, SerializedWidget } from "./types";

export function serializeWidget(widget: ResolvedWidget): SerializedWidget {
  const base = {
    id: widget.id,
    label: widget.label,
    icon: widget.icon,
    description: widget.description,
    layout: widget.layout,
  };

  switch (widget.type) {
    case "metric":
      return {
        ...base,
        type: "metric",
        format: widget.format,
        prefix: widget.prefix,
        suffix: widget.suffix,
      };
    case "list":
      return { ...base, type: "list", emptyMessage: widget.emptyMessage };
    case "chart":
      return {
        ...base,
        type: "chart",
        kind: widget.kind,
        color: widget.color,
        format: widget.format,
      };
    case "custom":
      return { ...base, type: "custom" };
  }
}

export function serializeDashboard(widgets: ResolvedWidget[]): SerializedWidget[] {
  return widgets.map(serializeWidget);
}
