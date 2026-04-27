/**
 * Widget builder: creates ResolvedWidget values used in dashboard configs.
 */

import type { Row } from "../resource/types";
import type {
  ChartWidgetConfig,
  CustomWidgetConfig,
  DashboardConfig,
  ListWidgetConfig,
  MetricWidgetConfig,
  ResolvedWidget,
  WidgetBuilder,
} from "./types";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function createWidgetBuilder<TCtx = unknown>(): WidgetBuilder<TCtx> {
  const usedIds = new Set<string>();

  const claim = (id: string): string => {
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let i = 2;
    while (usedIds.has(`${id}-${i}`)) i++;
    const next = `${id}-${i}`;
    usedIds.add(next);
    return next;
  };

  return {
    metric(config: MetricWidgetConfig<TCtx>): ResolvedWidget {
      const id = claim(config.id ?? slugify(config.label));
      return {
        id,
        type: "metric",
        label: config.label,
        icon: config.icon,
        description: config.description,
        layout: config.layout ?? { span: 3 },
        format: config.format,
        prefix: config.prefix,
        suffix: config.suffix,
        value: config.value as (ctx: unknown) => Promise<number | string | null>,
        trend: config.trend as
          | ((ctx: unknown) => Promise<import("./types").MetricTrend | null>)
          | undefined,
        sublabel: config.sublabel as
          | string
          | ((ctx: unknown) => Promise<string | null>)
          | undefined,
      };
    },

    list<TRow = Row>(config: ListWidgetConfig<TCtx, TRow>): ResolvedWidget {
      const id = claim(config.id ?? slugify(config.label));
      return {
        id,
        type: "list",
        label: config.label,
        icon: config.icon,
        description: config.description,
        layout: config.layout ?? { span: 6 },
        rows: config.rows as (ctx: unknown) => Promise<Row[]>,
        render: config.render as (row: Row) => import("./types").ListItem,
        limit: config.limit ?? 10,
        emptyMessage: config.emptyMessage,
      };
    },

    chart(config: ChartWidgetConfig<TCtx>): ResolvedWidget {
      const id = claim(config.id ?? slugify(config.label));
      return {
        id,
        type: "chart",
        label: config.label,
        icon: config.icon,
        description: config.description,
        layout: config.layout ?? { span: 12 },
        kind: config.kind ?? "bar",
        data: config.data as (ctx: unknown) => Promise<import("./types").ChartBucket[]>,
        color: config.color,
        format: config.format,
      };
    },

    custom<TData = unknown>(config: CustomWidgetConfig<TCtx, TData>): ResolvedWidget {
      const id = claim(config.id);
      return {
        id,
        type: "custom",
        label: config.label,
        icon: config.icon,
        description: config.description,
        layout: config.layout ?? { span: 12 },
        data: config.data as ((ctx: unknown) => Promise<unknown>) | undefined,
        component: config.component,
      };
    },
  };
}

/**
 * Resolves a DashboardConfig to a flat list of ResolvedWidget instances.
 *
 * Accepts any of:
 *  - ResolvedWidget[]                    — legacy / pre-built
 *  - (w) => ResolvedWidget[]             — builder function
 *  - { sections: Array<DashboardSection> } — grouped layout (B8)
 *
 * For sections, widgets from every section are flattened into one array
 * (so server-side evaluation stays dead simple); use `resolveSections` to
 * get the visual grouping back on the client.
 */
export function resolveDashboard<TCtx = unknown>(
  config: DashboardConfig<TCtx> | undefined,
): ResolvedWidget[] {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  if (typeof config === "function") {
    const builder = createWidgetBuilder<TCtx>();
    return config(builder);
  }
  // sections shape
  const out: ResolvedWidget[] = [];
  for (const section of config.sections) {
    const builder = createWidgetBuilder<TCtx>();
    const list = Array.isArray(section.widgets) ? section.widgets : section.widgets(builder);
    out.push(...list);
  }
  return out;
}

/**
 * Returns the section metadata (title/description + contained widget ids)
 * for a sections-shaped DashboardConfig. Returns null for flat configs.
 */
export function resolveSections<TCtx = unknown>(
  config: DashboardConfig<TCtx> | undefined,
): import("./types").ResolvedSection[] | null {
  if (!config || Array.isArray(config) || typeof config === "function") return null;
  const out: import("./types").ResolvedSection[] = [];
  for (const section of config.sections) {
    const builder = createWidgetBuilder<TCtx>();
    const list = Array.isArray(section.widgets) ? section.widgets : section.widgets(builder);
    out.push({
      title: section.title,
      ...(section.description ? { description: section.description } : {}),
      widgetIds: list.map((w) => w.id),
    });
  }
  return out;
}
