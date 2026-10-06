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
  plurals?: NonNullable<LabelsConfig["plurals"]>;
  searchPlaceholder: string;
  actions: Required<NonNullable<LabelsConfig["actions"]>>;
  form: Required<NonNullable<LabelsConfig["form"]>>;
  notFound: Required<NonNullable<LabelsConfig["notFound"]>>;
  access: Required<NonNullable<LabelsConfig["access"]>>;
  drawer: Required<NonNullable<LabelsConfig["drawer"]>>;
  detail: Required<NonNullable<LabelsConfig["detail"]>>;
  related: Required<NonNullable<LabelsConfig["related"]>>;
  formError: string;
  confirm: Required<NonNullable<LabelsConfig["confirm"]>>;
  widget: Required<Omit<NonNullable<LabelsConfig["widget"]>, "tones">> & {
    tones: Required<NonNullable<NonNullable<LabelsConfig["widget"]>["tones"]>>;
  };
  timeline: Required<NonNullable<LabelsConfig["timeline"]>>;
  heatmap: Required<NonNullable<LabelsConfig["heatmap"]>>;
  checklist: Required<NonNullable<LabelsConfig["checklist"]>>;
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
    empty: "No {label}",
    editCell: "Edit {label}",
    saved: "Saved",
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
  drawer: {
    close: "Close",
    viewDetails: "Open full page",
    loading: "Loading…",
    noRows: "No {resource}.",
    noWidgets: "No widgets configured.",
    chartElsewhere: "Chart visualization lives on dashboards. Data points: {n}.",
    unsupported: "A {kind} widget shows on dashboards and record pages, not in a drawer.",
    title: "Record",
    loadFailed: "Couldn't load this record.",
  },
  detail: {
    noFields: "No fields to show",
    unknownResource: "Unknown resource: {resource}",
    tabCount: "{label} · {count}",
  },
  related: { openList: "Open list" },
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
    taken: "{label} is already taken",
    conflict: "A record with these values already exists",
    missingReference: "{label} points to a record that does not exist",
    missingLink: "A linked record does not exist",
    inUse: "Other records still point to this one",
    createDisabled: "Create is disabled for this resource.",
    editDisabled: "Editing is disabled for this resource.",
  },
  notFound: {
    title: "Page not found",
    description: "The resource or dashboard you requested doesn't exist.",
    back: "Back to admin",
  },
  access: {
    signInTitle: "Sign in required",
    signInDescription: "You need to sign in to view this admin.",
    deniedTitle: "Access denied",
    deniedDescription: "Your account doesn't have permission to view this admin.",
  },
  formError: "Something went wrong — please try again.",
  confirm: { title: "Are you sure?", ok: "Confirm", cancel: "Cancel" },
  widget: {
    empty: "No data yet",
    seeAll: "See all",
    showAll: "Show all",
    updated: "Updated {ago}",
    justNow: "just now",
    secondsAgo: "{n}s ago",
    minutesAgo: "{n}m ago",
    chartsMissing: "Charts need recharts. Run `pnpm add recharts`.",
    previous: "was {value}",
    points: "{value} pp",
    vsPrevious: "vs previous period",
    vsWeekAgo: "vs a week earlier",
    other: "Other",
    expired: "No data: kept for {days} days",
    keptSince: "Since {date}; older data is not kept",
    dataAsOf: "Data as of {time}",
    observations: "{n} observed",
    allClear: "All clear",
    more: "{n} more",
    filtered: "Nothing matches the current filters.",
    tones: { err: "Error", warn: "Warning", ok: "OK", info: "Info" },
  },
  timeline: {
    all: "All",
    today: "Today",
    yesterday: "Yesterday",
    event: "{n} event",
    events: "{n} events",
    folded: "×{n}",
    older: "Older",
    newest: "Newest",
  },
  heatmap: {
    summary: "{total} in the last {days} days",
    cell: "{date}: {value}",
    less: "Less",
    more: "More",
  },
  checklist: {
    summary: "{done} of {total}",
    gap: "+{duration}",
    done: "Done",
    todo: "Not done",
    optional: "Optional",
  },
  errors: {
    queryTitle: "{resource}: {operation} failed",
    queryHint: "Check the column list and the database schema. Details are in the server log.",
    connectionHint:
      "The database refused the connection or is unreachable. Check DATABASE_URL and that the server accepts connections.",
    requestId: "Request {id}",
    widgetTitle: "Couldn't load this widget",
    widgetHint: "Its query failed. Retry, or look in the server log.",
    retry: "Retry",
    details: "Details",
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
