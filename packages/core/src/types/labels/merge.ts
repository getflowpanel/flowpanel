import type { LabelsConfig, PluralLabel } from "./config";
import { DEFAULT_LABELS, type ResolvedLabels } from "./defaults";

const isEmpty = (o: object): boolean => Object.keys(o).length === 0;

/** JavaScript consumers may explicitly pass undefined; it is not an override. */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** A base plural gives way to the host's own string template for the same count. */
function mergePlurals(user: LabelsConfig, base: ResolvedLabels): ResolvedLabels["plurals"] {
  const plurals = { ...base.plurals };
  if (user.table?.result !== undefined || user.table?.results !== undefined) {
    delete plurals.results;
  }
  if (user.bulkBar?.selected !== undefined) delete plurals.selected;
  if (user.timeline?.event !== undefined || user.timeline?.events !== undefined)
    delete plurals.events;
  Object.assign(plurals, defined(user.plurals ?? {}));
  return Object.keys(plurals).length > 0 ? plurals : undefined;
}

/** Merge `user` over `base` — English by default — one nested group at a time. */
export function mergeLabels(
  user?: LabelsConfig,
  base: ResolvedLabels = DEFAULT_LABELS,
): ResolvedLabels {
  if (!user || isEmpty(user)) return base;
  const { plurals: _basePlurals, ...rest } = base;
  const plurals = mergePlurals(user, base);
  return {
    ...rest,
    ...defined(user),
    navigation: { ...base.navigation, ...defined(user.navigation ?? {}) },
    table: { ...base.table, ...defined(user.table ?? {}) },
    dateRange: { ...base.dateRange, ...defined(user.dateRange ?? {}) },
    savedViews: { ...base.savedViews, ...defined(user.savedViews ?? {}) },
    pagination: { ...base.pagination, ...defined(user.pagination ?? {}) },
    filters: { ...base.filters, ...defined(user.filters ?? {}) },
    bulkBar: { ...base.bulkBar, ...defined(user.bulkBar ?? {}) },
    ...(plurals ? { plurals } : {}),
    actions: { ...base.actions, ...defined(user.actions ?? {}) },
    form: { ...base.form, ...defined(user.form ?? {}) },
    notFound: { ...base.notFound, ...defined(user.notFound ?? {}) },
    access: { ...base.access, ...defined(user.access ?? {}) },
    drawer: { ...base.drawer, ...defined(user.drawer ?? {}) },
    detail: { ...base.detail, ...defined(user.detail ?? {}) },
    related: { ...base.related, ...defined(user.related ?? {}) },
    confirm: { ...base.confirm, ...defined(user.confirm ?? {}) },
    widget: {
      ...base.widget,
      ...defined(user.widget ?? {}),
      tones: { ...base.widget.tones, ...defined(user.widget?.tones ?? {}) },
    },
    timeline: { ...base.timeline, ...defined(user.timeline ?? {}) },
    heatmap: { ...base.heatmap, ...defined(user.heatmap ?? {}) },
    checklist: { ...base.checklist, ...defined(user.checklist ?? {}) },
    errors: { ...base.errors, ...defined(user.errors ?? {}) },
    palette: { ...base.palette, ...defined(user.palette ?? {}) },
  };
}

/** Substitute `{key}` placeholders in a label template with values. */
export function formatLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** Pick a count label's plural form for `count` in `locale`, then fill `{n}` with `display`. */
export function formatCount(
  label: string | PluralLabel,
  count: number,
  locale: string,
  display: string | number = count,
): string {
  const form =
    typeof label === "string"
      ? label
      : (label[new Intl.PluralRules(locale).select(count) as keyof PluralLabel] ?? label.other);
  return formatLabel(form, { n: display });
}
