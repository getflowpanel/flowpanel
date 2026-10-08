import type {
  DateRangePreset,
  RequestContext,
  ResolvedAdminConfig,
  Session,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { RealtimeRefresh } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";
import { renderWidget } from "./render-widget";
import { rowKeyOf } from "./row-identity";
import { buildWidgetContext } from "./widget-context";

export interface AdminWidgetContextOptions {
  /** The signed-in session widgets see as `ctx.session`. @defaultValue null */
  session?: Session | null;
  /** The role every access check compares. @defaultValue "admin" */
  role?: string;
  /** The picked period; its previous period follows. @defaultValue the whole history until now */
  range?: { from: Date; to: Date; preset?: DateRangePreset };
  /** The viewed record, for a record-page widget. */
  row?: Record<string, unknown>;
  /** The resource `row` belongs to: its `rowKey` names `ctx.id`, and `ctx.rowOf` checks it. */
  resource?: string;
  /** The dashboard filters widgets read as `ctx.filters`. @defaultValue {} */
  filters?: Readonly<Record<string, string>>;
  /** @defaultValue `http://localhost` followed by the admin's mount */
  url?: string;
}

/** What a widget renders with: its kind, and the props its card receives. */
export interface ResolvedWidget {
  kind: WidgetConfig["kind"];
  props: Record<string, unknown>;
}

interface Bound {
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
}

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const BOUND = new WeakMap<WidgetContext, Bound>();

/**
 * The context a widget receives in this admin — its memo, links, formatters, access checks
 * and adapter — for a unit or integration test. It carries no tenant scope.
 */
export function adminWidgetContext(
  config: ResolvedAdminConfig,
  options: AdminWidgetContextOptions = {},
): WidgetContext {
  const req = new Request(options.url ?? `http://localhost${config.paths.admin}`);
  const reqCtx: RequestContext = {
    req,
    session: options.session ?? null,
    role: options.role ?? "admin",
    scope: null,
    ip: null,
    userAgent: null,
  };
  const range = {
    from: options.range?.from ?? new Date(0),
    to: options.range?.to ?? new Date(),
    preset: options.range?.preset ?? ("custom" as const),
  };
  const owner = options.resource ? config.resourcesByName.get(options.resource) : undefined;
  const rowKey = owner ? rowKeyOf(owner) : DEFAULT_RESOURCE_ROW_KEY;
  const ctx = buildWidgetContext(
    config,
    reqCtx,
    req,
    range,
    options.row,
    rowKey,
    options.resource,
    options.filters ?? {},
  );
  BOUND.set(ctx, { config, reqCtx });
  return ctx;
}

const wraps = (children: unknown): boolean =>
  Array.isArray(children)
    ? children.some((child) => isValidElement(child))
    : isValidElement(children);

const isAsync = (type: unknown): type is (props: unknown) => Promise<ReactNode> =>
  typeof type === "function" && type.constructor.name === "AsyncFunction";

/**
 * The props of the first card in a rendered widget: the element of `target` when given,
 * else the first component that wraps no other element. Async wrappers are awaited.
 */
export async function cardProps(
  node: ReactNode,
  target?: unknown,
): Promise<Record<string, unknown> | null> {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = await cardProps(child, target);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const { type, props } = node as Element;
  if (target !== undefined && type === target) return props;
  if (isAsync(type)) return cardProps(await type(props), target);
  const component = typeof type === "function" || (typeof type === "object" && type !== null);
  if (target === undefined && component && type !== RealtimeRefresh && !wraps(props.children)) {
    return props;
  }
  return cardProps(props.children, target);
}

/**
 * Render a widget against the admin its context was built for, and return what its card
 * receives — a custom widget's own props rather than its frame's. A failing query rejects.
 */
export async function resolveWidget(
  widget: WidgetConfig,
  ctx: WidgetContext,
): Promise<ResolvedWidget> {
  const bound = BOUND.get(ctx);
  if (!bound) {
    throw new Error(
      "flowpanel: resolveWidget needs a context from adminWidgetContext(), or from widgetContext() " +
        "in @flowpanel/kit/test/widgets; a hand-built context carries no admin to render against.",
    );
  }
  const node = await renderWidget(widget, ctx, bound.config, bound.reqCtx);
  const props = await cardProps(node, widget.kind === "custom" ? widget.Component : undefined);
  if (!props)
    throw new Error(`flowpanel: resolveWidget found no card for a "${widget.kind}" widget.`);
  return { kind: widget.kind, props };
}
