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
  /** Full-page detail chrome. */
  detail?: {
    /** A fields tab with nothing the reader is allowed to see. */
    noFields?: string;
    /** A tab naming a resource that is not registered. Use `{resource}`. */
    unknownResource?: string;
  };
  /** Related detail-tab chrome. */
  related?: {
    /** Link from a related tab to the target resource's own list. */
    openList?: string;
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
  /** Dashboard and detail-tab widget chrome. */
  widget?: {
    /** Zero-row state shared by tables, cards and charts. */
    empty?: string;
    /** Link from a card heading to the full list. */
    seeAll?: string;
    /** Freshness stamp on a refreshing dashboard. Use `{ago}`. */
    updated?: string;
    justNow?: string;
    /** Use `{n}` for the second count. */
    secondsAgo?: string;
    /** Use `{n}` for the minute count. */
    minutesAgo?: string;
    /** Shown where a chart would be when @flowpanel/charts is missing. */
    chartsMissing?: string;
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
