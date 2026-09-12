/** Localizable strings for FlowPanel's built-in chrome. */
export interface LabelsConfig {
  /** Empty list state — used when a resource list returns 0 rows. */
  noResults?: string;
  /** Empty filter / select dropdown — the "any/all" sentinel. */
  allOption?: string;
  navigation?: {
    skipToContent?: string;
    admin?: string;
    open?: string;
    title?: string;
    accountMenu?: string;
    account?: string;
    signOut?: string;
    scrollHint?: string;
    dashboards?: string;
    resources?: string;
    pages?: string;
    queues?: string;
    theme?: string;
    toggleTheme?: string;
  };
  table?: {
    /** Templates use `{n}`. Separate one/many templates avoid English suffixes. */
    result?: string;
    results?: string;
    actions?: string;
    rowActions?: string;
    rowsHint?: string;
    rowsReadOnlyHint?: string;
    selectRow?: string;
    selectAll?: string;
    deselectAll?: string;
  };
  dateRange?: {
    /** Locale for calendar presentation; identical during SSR and hydration. */
    locale?: string;
    label?: string;
    fieldLabel?: string;
    any?: string;
    clear?: string;
    clearAction?: string;
    from?: string;
    until?: string;
    previousMonth?: string;
    nextMonth?: string;
    firstMonth?: string;
    secondMonth?: string;
    pickEnd?: string;
    noSelection?: string;
    today?: string;
    yesterday?: string;
    last7d?: string;
    last30d?: string;
    thisMonth?: string;
    lastMonth?: string;
    MTD?: string;
    QTD?: string;
    YTD?: string;
  };
  savedViews?: {
    save?: string;
    saveTrigger?: string;
    name?: string;
    current?: string;
    label?: string;
    yours?: string;
    saveCurrent?: string;
    saved?: string;
    deleted?: string;
    delete?: string;
    storageError?: string;
  };
  /** Pagination chrome. */
  pagination?: {
    label?: string;
    previous?: string;
    next?: string;
    of?: string;
    rowsPerPage?: string;
    /** Accessible page button name. Use `{n}` for the page number. */
    page?: string;
    /** Page-size option. Use `{n}` for the row count. */
    pageSize?: string;
  };
  filters?: {
    label?: string;
    clear?: string;
    yes?: string;
    no?: string;
    searchPlaceholder?: string;
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
    edit?: string;
    save?: string;
    cancel?: string;
    delete?: string;
    restore?: string;
    new?: string;
    create?: string;
    export?: string;
    import?: string;
  };
  /** Generated create and edit form chrome. */
  form?: {
    /** Edit page heading. Use `{label}` for the resource's singular label. */
    editTitle?: string;
    /** Create page heading. Use `{label}` for the resource's singular label. */
    createTitle?: string;
    /** The empty choice in a select control. */
    selectPlaceholder?: string;
    /** A reference search with nothing to offer. */
    noOptions?: string;
    /** A reference search still in flight. */
    searching?: string;
    /** A reference search that failed. */
    loadFailed?: string;
  };
  /** Drawer chrome. */
  drawer?: {
    close?: string;
    viewDetails?: string;
  };
  /** The admin's own not-found page, for a URL no resource or dashboard matches. */
  notFound?: {
    title?: string;
    description?: string;
    back?: string;
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
    title?: string;
    description?: string;
    loading?: string;
  };
}

/** Singleton defaults. Plain strings only — RSC-serializable. */
export const DEFAULT_LABELS: {
  noResults: string;
  allOption: string;
  navigation: Required<NonNullable<LabelsConfig["navigation"]>>;
  table: Required<NonNullable<LabelsConfig["table"]>>;
  dateRange: Required<NonNullable<LabelsConfig["dateRange"]>>;
  savedViews: Required<NonNullable<LabelsConfig["savedViews"]>>;
  pagination: Required<NonNullable<LabelsConfig["pagination"]>>;
  filters: Required<NonNullable<LabelsConfig["filters"]>>;
  bulkBar: Required<NonNullable<LabelsConfig["bulkBar"]>>;
  searchPlaceholder: string;
  actions: Required<NonNullable<LabelsConfig["actions"]>>;
  form: Required<NonNullable<LabelsConfig["form"]>>;
  notFound: Required<NonNullable<LabelsConfig["notFound"]>>;
  drawer: Required<NonNullable<LabelsConfig["drawer"]>>;
  formError: string;
  confirm: Required<NonNullable<LabelsConfig["confirm"]>>;
  palette: Required<NonNullable<LabelsConfig["palette"]>>;
} = {
  noResults: "No results",
  allOption: "All",
  navigation: {
    skipToContent: "Skip to main content",
    admin: "Admin",
    open: "Open navigation",
    title: "Navigation",
    accountMenu: "Account menu",
    account: "Account",
    signOut: "Sign out",
    scrollHint: "More destinations are available by horizontal scrolling.",
    dashboards: "Dashboards",
    resources: "Resources",
    pages: "Pages",
    queues: "Queues",
    theme: "Theme",
    toggleTheme: "Toggle dark mode",
  },
  table: {
    result: "{n} result",
    results: "{n} results",
    actions: "Actions",
    rowActions: "Row actions",
    rowsHint: "Rows. Arrow keys or j and k move, Enter opens.",
    rowsReadOnlyHint: "Rows. Arrow keys or j and k move.",
    selectRow: "Select row {id}",
    selectAll: "Select all rows on this page",
    deselectAll: "Deselect all rows on this page",
  },
  dateRange: {
    locale: "en-US",
    label: "Date range",
    fieldLabel: "{label}: date range",
    any: "Any date",
    clear: "Clear date range",
    clearAction: "Clear",
    from: "From {date}",
    until: "Until {date}",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    firstMonth: "First month",
    secondMonth: "Second month",
    pickEnd: "Pick an end date",
    noSelection: "No range selected",
    today: "Today",
    yesterday: "Yesterday",
    last7d: "Last 7 days",
    last30d: "Last 30 days",
    thisMonth: "This month",
    lastMonth: "Last month",
    MTD: "Month to date",
    QTD: "Quarter to date",
    YTD: "Year to date",
  },
  savedViews: {
    save: "Save view",
    saveTrigger: "Save view…",
    name: "Name this view",
    current: "View: {name}",
    label: "Views",
    yours: "Yours",
    saveCurrent: "Save current view…",
    saved: 'Saved view "{name}"',
    deleted: 'Deleted view "{name}"',
    delete: "Delete view {name}",
    storageError: "Your browser could not save this view. Allow site storage and try again.",
  },
  pagination: {
    label: "Pagination",
    previous: "Previous page",
    next: "Next page",
    of: "of",
    rowsPerPage: "Rows per page",
    page: "Page {n}",
    pageSize: "{n} / page",
  },
  filters: {
    label: "Filters",
    clear: "Clear filters",
    yes: "Yes",
    no: "No",
    searchPlaceholder: "Search…",
  },
  bulkBar: { selected: "{n} selected", clear: "Clear" },
  searchPlaceholder: "Search {label}…",
  actions: {
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    restore: "Restore",
    new: "New",
    create: "Create",
    export: "Export",
    import: "Import",
  },
  drawer: { close: "Close", viewDetails: "Open full page →" },
  form: {
    editTitle: "Edit {label}",
    createTitle: "New {label}",
    selectPlaceholder: "Select…",
    noOptions: "No options",
    searching: "Searching…",
    loadFailed: "Couldn't load options — please try again.",
  },
  notFound: {
    title: "Page not found",
    description: "The resource or dashboard you requested doesn't exist.",
    back: "Back to admin",
  },
  formError: "Please fix the errors above.",
  confirm: { title: "Are you sure?", ok: "Confirm", cancel: "Cancel" },
  palette: {
    placeholder: "Search resources, actions…",
    noResults: "No results.",
    title: "Command palette",
    description: "Search and run admin commands",
    loading: "Loading…",
  },
} as const;

/** The fully-resolved shape consumers see — every nested key is present. */
export type ResolvedLabels = typeof DEFAULT_LABELS;

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
    confirm: { ...DEFAULT_LABELS.confirm, ...defined(user.confirm ?? {}) },
    palette: { ...DEFAULT_LABELS.palette, ...defined(user.palette ?? {}) },
  };
}

/** Substitute `{key}` placeholders in a label template with values. */
export function formatLabel(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
