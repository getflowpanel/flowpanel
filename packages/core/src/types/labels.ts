/**
 * Localizable strings for FlowPanel's built-in chrome.
 *
 * Pass via `defineAdmin({ labels: { ... } })`. Unset keys fall back to
 * English defaults.
 *
 * Templates use `{name}` placeholders. The resolver `formatLabel(template, vars)`
 * substitutes them. We use plain strings (not functions) so the labels object
 * can be serialized across the React Server Components boundary — `defineAdmin`
 * is server-evaluated, but the labels are consumed in client components like
 * BulkBar via `useLabels()`.
 */
export interface LabelsConfig {
  /** Empty list state — used when a resource list returns 0 rows. */
  noResults?: string;
  /** Empty filter / select dropdown — the "any/all" sentinel. */
  allOption?: string;
  /** Pagination chrome. */
  pagination?: {
    previous?: string;
    next?: string;
    of?: string;
    rowsPerPage?: string;
  };
  /** Bulk action bar. */
  bulkBar?: {
    /** Use `{n}` for the selection count. Default: `"{n} selected"`. */
    selected?: string;
    clear?: string;
  };
  /** Resource search input placeholder. Use `{label}` for the resource's label. */
  searchPlaceholder?: string;
  /** Generic action buttons. */
  actions?: {
    save?: string;
    cancel?: string;
    delete?: string;
    restore?: string;
    new?: string;
    export?: string;
  };
  /** Drawer chrome. */
  drawer?: {
    close?: string;
    viewDetails?: string;
  };
  /** Form-level error summary banner. */
  formError?: string;
  /** Confirm dialog. */
  confirm?: {
    title?: string;
    ok?: string;
    cancel?: string;
  };
  /** ⌘K palette. */
  palette?: {
    placeholder?: string;
    noResults?: string;
  };
}

/** Singleton defaults. Plain strings only — RSC-serializable. */
export const DEFAULT_LABELS: {
  noResults: string;
  allOption: string;
  pagination: Required<NonNullable<LabelsConfig["pagination"]>>;
  bulkBar: Required<NonNullable<LabelsConfig["bulkBar"]>>;
  searchPlaceholder: string;
  actions: Required<NonNullable<LabelsConfig["actions"]>>;
  drawer: Required<NonNullable<LabelsConfig["drawer"]>>;
  formError: string;
  confirm: Required<NonNullable<LabelsConfig["confirm"]>>;
  palette: Required<NonNullable<LabelsConfig["palette"]>>;
} = {
  noResults: "No results",
  allOption: "All",
  pagination: { previous: "Previous", next: "Next", of: "of", rowsPerPage: "Rows per page" },
  bulkBar: { selected: "{n} selected", clear: "Clear" },
  searchPlaceholder: "Search {label}…",
  actions: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    restore: "Restore",
    new: "New",
    export: "Export",
  },
  drawer: { close: "Close", viewDetails: "Open full page →" },
  formError: "Please fix the errors above.",
  confirm: { title: "Are you sure?", ok: "Confirm", cancel: "Cancel" },
  palette: { placeholder: "Type a command or search…", noResults: "Nothing matches" },
} as const;

/** The fully-resolved shape consumers see — every nested key is present. */
export type ResolvedLabels = typeof DEFAULT_LABELS;

const isEmpty = (o: object): boolean => Object.keys(o).length === 0;

export function mergeLabels(user?: LabelsConfig): ResolvedLabels {
  if (!user || isEmpty(user)) return DEFAULT_LABELS;
  return {
    ...DEFAULT_LABELS,
    ...user,
    pagination: { ...DEFAULT_LABELS.pagination, ...(user.pagination ?? {}) },
    bulkBar: { ...DEFAULT_LABELS.bulkBar, ...(user.bulkBar ?? {}) },
    actions: { ...DEFAULT_LABELS.actions, ...(user.actions ?? {}) },
    drawer: { ...DEFAULT_LABELS.drawer, ...(user.drawer ?? {}) },
    confirm: { ...DEFAULT_LABELS.confirm, ...(user.confirm ?? {}) },
    palette: { ...DEFAULT_LABELS.palette, ...(user.palette ?? {}) },
  } as ResolvedLabels;
}

/**
 * Substitute `{key}` placeholders in a label template with values.
 *
 * @example
 *   formatLabel("{n} selected", { n: 3 })  // → "3 selected"
 *   formatLabel("Search {label}…", { label: "users" })  // → "Search users…"
 */
export function formatLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
