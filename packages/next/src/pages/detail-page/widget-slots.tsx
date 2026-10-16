import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { WidgetErrorBoundary } from "@flowpanel/next/client";
import { ErrorCard } from "@flowpanel/react";
import type { ReactNode } from "react";
import { isControlFlow } from "../../runtime/query-error";
import { renderWidget, type WidgetFrame } from "../../runtime/render-widget";
import { visibleWidgets } from "../../runtime/widget-access";
import {
  describeOwner,
  pageTimer,
  type WidgetOwner,
  widgetOwner,
} from "../../runtime/widget-owner";
import { widgetSlotClassName } from "../widget-slot";

export interface RenderedSlot {
  className: string | undefined;
  owner: WidgetOwner;
  node: ReactNode;
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Renders each widget in its own slot; a failure becomes that slot's error card, named by its owner. */
export async function renderSlots(
  widgets: readonly WidgetConfig[],
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  where: string,
  frame: WidgetFrame = {},
): Promise<RenderedSlot[]> {
  const shown = await visibleWidgets(widgets, reqCtx);
  const timer = pageTimer(where, shown.length);
  return Promise.all(
    shown.map(async (widget, index) => {
      const owner = widgetOwner(widget, where, `widget ${index + 1}`);
      const className = widgetSlotClassName(widget);
      try {
        const node = await timer.run(owner, () => renderWidget(widget, ctx, config, reqCtx, frame));
        return { className, owner, node };
      } catch (failure) {
        if (isControlFlow(failure)) throw failure;
        console.error(`[flowpanel] widget ${describeOwner(owner)} failed`, failure);
        const node = (
          <ErrorCard
            error={asError(failure)}
            {...(frame.plain ? { plain: true } : {})}
            {...(owner.label ? { title: owner.label } : {})}
          />
        );
        return { className, owner, node };
      }
    }),
  );
}

/** Each slot in its own error boundary; `className` replaces the slots' span classes. */
export function slotElements(
  slots: RenderedSlot[],
  className?: string,
  plain?: boolean,
): ReactNode[] {
  return slots.map((slot, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: widget order is stable
    <div key={index} className={className ?? slot.className}>
      <WidgetErrorBoundary
        widgetId={describeOwner(slot.owner)}
        {...(plain ? { plain: true } : {})}
        {...(slot.owner.label ? { title: slot.owner.label } : {})}
      >
        {slot.node}
      </WidgetErrorBoundary>
    </div>
  ));
}
