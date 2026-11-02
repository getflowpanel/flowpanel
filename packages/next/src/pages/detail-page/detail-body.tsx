import type {
  DetailOptions,
  RequestContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { StatStrip } from "@flowpanel/react";
import type { ReactNode } from "react";
import { renderSlots, slotElements } from "./widget-slots";

type Detail = DetailOptions<Record<string, unknown>> | undefined;

/** `detail.stats` as one hairline strip of plain cells; `null` when there are none. */
export async function recordStrip(
  detail: Detail,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  name: string,
): Promise<ReactNode> {
  const stats = detail?.stats ?? [];
  if (stats.length === 0) return null;
  const slots = await renderSlots(stats, ctx, config, reqCtx, `${name} stats`, { plain: true });
  return <StatStrip>{slotElements(slots, "fp-flex fp-min-w-0", true)}</StatStrip>;
}

/** `detail.aside`, stacked; `null` when there is none. */
export async function recordAside(
  detail: Detail,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  name: string,
): Promise<ReactNode[] | null> {
  const aside = detail?.aside ?? [];
  if (aside.length === 0) return null;
  return slotElements(await renderSlots(aside, ctx, config, reqCtx, `${name} aside`), "fp-min-w-0");
}

/** Strip, then the tabs with the aside beside them from `lg`, below them on a phone. */
export function recordLayout(
  strip: ReactNode,
  main: ReactNode,
  aside: ReactNode[] | null,
): ReactNode {
  return (
    <>
      {strip ? <div className="fp-mb-4">{strip}</div> : null}
      {aside ? (
        <div
          className="fp-grid fp-gap-4 lg:fp-grid-cols-[minmax(0,1fr)_clamp(16rem,33%,25rem)]"
          data-record-layout=""
        >
          <div className="fp-min-w-0">{main}</div>
          <aside className="fp-min-w-0 fp-space-y-3">{aside}</aside>
        </div>
      ) : (
        main
      )}
    </>
  );
}
