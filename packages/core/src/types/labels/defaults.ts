import type { LabelsConfig } from "./config";

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
  detail: Required<NonNullable<LabelsConfig["detail"]>>;
  related: Required<NonNullable<LabelsConfig["related"]>>;
  formError: string;
  confirm: Required<NonNullable<LabelsConfig["confirm"]>>;
  widget: Required<NonNullable<LabelsConfig["widget"]>>;
  errors: Required<NonNullable<LabelsConfig["errors"]>>;
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
  detail: {
    noFields: "No fields to show",
    unknownResource: "Unknown resource: {resource}",
  },
  related: { openList: "Open list →" },
  form: {
    editTitle: "Edit {label}",
    createTitle: "New {label}",
    selectPlaceholder: "Select…",
    noOptions: "No options",
    searching: "Searching…",
    loadFailed: "Couldn't load options — please try again.",
    required: "{label} is required",
    invalidNumber: "{label} must be a number",
    invalidBoolean: "{label} must be yes or no",
    invalidDate: "{label} must be a date",
  },
  notFound: {
    title: "Page not found",
    description: "The resource or dashboard you requested doesn't exist.",
    back: "Back to admin",
  },
  formError: "Please fix the errors above.",
  confirm: { title: "Are you sure?", ok: "Confirm", cancel: "Cancel" },
  widget: {
    empty: "No data yet",
    seeAll: "See all",
    updated: "Updated {ago}",
    justNow: "just now",
    secondsAgo: "{n}s ago",
    minutesAgo: "{n}m ago",
    chartsMissing: "Charts package not installed — run `pnpm add @flowpanel/charts`.",
  },
  errors: {
    queryTitle: "{resource}: {operation} failed",
    queryHint: "Check the column list and the database schema. Details are in the server log.",
    requestId: "Request {id}",
    widgetTitle: "Widget failed",
    widgetHint: "Couldn't load this widget.",
    retry: "Retry",
  },
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
