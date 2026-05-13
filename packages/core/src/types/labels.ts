/**
 * Localizable strings for FlowPanel's built-in chrome.
 *
 * Pass via `defineAdmin({ labels: { ... } })`. Unset keys fall back to
 * English defaults. Function-valued labels (e.g. `bulkBar.selected`) are
 * replaced wholesale, not deep-merged.
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
    selected?: (n: number) => string;
    clear?: string;
  };
  /** Resource search input placeholder. `resourceLabel` is the resource's `label` config. */
  searchPlaceholder?: (resourceLabel: string) => string;
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

/** Singleton defaults. Keep stable referential equality so consumers can short-circuit. */
export const DEFAULT_LABELS: {
  noResults: string;
  allOption: string;
  pagination: Required<NonNullable<LabelsConfig["pagination"]>>;
  bulkBar: Required<NonNullable<LabelsConfig["bulkBar"]>>;
  searchPlaceholder: (resourceLabel: string) => string;
  actions: Required<NonNullable<LabelsConfig["actions"]>>;
  drawer: Required<NonNullable<LabelsConfig["drawer"]>>;
  formError: string;
  confirm: Required<NonNullable<LabelsConfig["confirm"]>>;
  palette: Required<NonNullable<LabelsConfig["palette"]>>;
} = {
  noResults: "No results",
  allOption: "All",
  pagination: { previous: "Previous", next: "Next", of: "of", rowsPerPage: "Rows per page" },
  bulkBar: { selected: (n) => `${n} selected`, clear: "Clear" },
  searchPlaceholder: (label) => `Search ${label.toLowerCase()}…`,
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
    // searchPlaceholder, noResults, allOption, formError are top-level scalars/functions
    // already covered by ...user spread above.
  } as ResolvedLabels;
}
