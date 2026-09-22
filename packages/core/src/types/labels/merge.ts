import type { LabelsConfig } from "./config";
import { DEFAULT_LABELS, type ResolvedLabels } from "./defaults";

const isEmpty = (o: object): boolean => Object.keys(o).length === 0;

/** JavaScript consumers may explicitly pass undefined; it is not an override. */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function mergeLabels(user?: LabelsConfig): ResolvedLabels {
  if (!user || isEmpty(user)) return DEFAULT_LABELS;
  return {
    ...DEFAULT_LABELS,
    ...defined(user),
    navigation: { ...DEFAULT_LABELS.navigation, ...defined(user.navigation ?? {}) },
    table: { ...DEFAULT_LABELS.table, ...defined(user.table ?? {}) },
    dateRange: { ...DEFAULT_LABELS.dateRange, ...defined(user.dateRange ?? {}) },
    savedViews: { ...DEFAULT_LABELS.savedViews, ...defined(user.savedViews ?? {}) },
    pagination: { ...DEFAULT_LABELS.pagination, ...defined(user.pagination ?? {}) },
    filters: { ...DEFAULT_LABELS.filters, ...defined(user.filters ?? {}) },
    bulkBar: { ...DEFAULT_LABELS.bulkBar, ...defined(user.bulkBar ?? {}) },
    actions: { ...DEFAULT_LABELS.actions, ...defined(user.actions ?? {}) },
    form: { ...DEFAULT_LABELS.form, ...defined(user.form ?? {}) },
    notFound: { ...DEFAULT_LABELS.notFound, ...defined(user.notFound ?? {}) },
    drawer: { ...DEFAULT_LABELS.drawer, ...defined(user.drawer ?? {}) },
    detail: { ...DEFAULT_LABELS.detail, ...defined(user.detail ?? {}) },
    related: { ...DEFAULT_LABELS.related, ...defined(user.related ?? {}) },
    confirm: { ...DEFAULT_LABELS.confirm, ...defined(user.confirm ?? {}) },
    widget: { ...DEFAULT_LABELS.widget, ...defined(user.widget ?? {}) },
    errors: { ...DEFAULT_LABELS.errors, ...defined(user.errors ?? {}) },
    palette: { ...DEFAULT_LABELS.palette, ...defined(user.palette ?? {}) },
  };
}

/** Substitute `{key}` placeholders in a label template with values. */
export function formatLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
