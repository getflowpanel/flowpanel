import type {
  KvItem,
  KvOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  StatItem,
  StatResult,
  StatValue,
  StatWidget,
  WidgetContext,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { kvDisplay } from "./kv-display";
import { resolveLink } from "./resolve-link";
import { statDisplay, statResultOf } from "./stat-result";

/** A `stat`, `kv` or `statGroup` value, bare or a result object, as one result shape. */
export async function resolveItem(
  value: StatWidget["value"] | KvItem["value"],
  ctx: WidgetContext,
  reqCtx?: RequestContext,
): Promise<StatResult> {
  if (typeof value !== "function") return statResultOf(value);
  return statResultOf(
    reqCtx ? await runWithRequestContext(reqCtx, () => value(ctx)) : await value(ctx),
  );
}

/** A `kv` item as its card renders it; the result's tone and link win over the item's. */
export async function kvItemOf(
  item: KvItem,
  ctx: WidgetContext,
  formatting: ResolvedFormatting,
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
  record?: Record<string, unknown> | null,
) {
  const result: StatResult =
    item.field !== undefined
      ? { value: (record?.[item.field] ?? null) as StatValue }
      : await resolveItem(item.value, ctx, reqCtx);
  const tone = result.tone ?? item.tone;
  const href = resolveLink(config, ctx, result.href ?? item.href);
  return {
    label: item.label,
    value: kvDisplay(result.value, item.format, formatting),
    ...(tone ? { tone } : {}),
    ...(href ? { href } : {}),
  };
}

/** A `statGroup` item as its card renders it; the result's tone wins over the item's. */
export async function statItemOf(
  item: StatItem,
  ctx: WidgetContext,
  formatting: ResolvedFormatting,
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
) {
  const result = await resolveItem(item.value, ctx, reqCtx);
  const tone = result.tone ?? item.tone;
  const href = resolveLink(config, ctx, result.href);
  return {
    label: item.label,
    value: statDisplay(result.value, formatting),
    ...(item.format ? { format: item.format } : {}),
    ...(tone ? { tone } : {}),
    ...(href ? { href } : {}),
  };
}

/** A `kv` card's items; `field` items read the card's `record`, else the viewed row. */
export async function kvItems(
  options: KvOptions,
  ctx: WidgetContext,
  formatting: ResolvedFormatting,
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
) {
  const load = options.record;
  const record = load
    ? await (reqCtx ? runWithRequestContext(reqCtx, async () => load(ctx)) : load(ctx))
    : ctx.row;
  return Promise.all(
    options.items.map((item) =>
      kvItemOf(
        item,
        ctx,
        formatting,
        config,
        reqCtx,
        (record ?? null) as Record<string, unknown> | null,
      ),
    ),
  );
}
