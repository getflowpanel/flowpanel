import type { WidgetLabels } from "./widget-labels";

/**
 * A count template per `Intl.PluralRules` category of the admin's
 * `formatting.locale`; a missing category falls back to `other`. Use `{n}`.
 * @example { one: "{n} запись", few: "{n} записи", many: "{n} записей", other: "{n} записи" }
 */
export interface PluralLabel {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

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
  /**
   * Count templates with one form per `Intl.PluralRules` category of
   * `formatting.locale`. When set, they win over `table.result`/`table.results`
   * and `bulkBar.selected`.
   */
  plurals?: {
    /** The table's row count, every count `1` included. */
    results?: PluralLabel;
    /** The bulk bar's and a multi-select filter's selection count. */
    selected?: PluralLabel;
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
    /** An empty value the write needs. Use `{label}` for the field's label. */
    required?: string;
    /** A value that is not a number. Use `{label}`. */
    invalidNumber?: string;
    /** A value that is neither true nor false. Use `{label}`. */
    invalidBoolean?: string;
    /** A value that is not a date. Use `{label}`. */
    invalidDate?: string;
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
    /** A counted tab's label. Use `{label}` and `{count}`. */
    tabCount?: string;
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
  /** The screens shown in place of the admin when `auth.signInUrl` or `auth.forbiddenUrl` is not set. */
  access?: {
    /** No session: the reader has to sign in. */
    signInTitle?: string;
    signInDescription?: string;
    /** A session whose role the admin does not allow. */
    deniedTitle?: string;
    deniedDescription?: string;
  };
  /** Form-level banner shown when a submit fails with no field errors of its own. */
  formError?: string;
  /** Confirm dialog. */
  confirm?: {
    title?: string;
    ok?: string;
    cancel?: string;
  };
  /** Dashboard and detail-tab widget chrome. */
  widget?: WidgetLabels;
  /** FlowPanel's own failure surfaces, shown in place of the data that did not load. */
  errors?: {
    /** Failed page read. Use `{resource}` and `{operation}`. */
    queryTitle?: string;
    /** What to check after a failed page read. */
    queryHint?: string;
    /** Correlation line tying the card to the server log. Use `{id}`. */
    requestId?: string;
    /** Failed widget, shown in the widget's own frame. */
    widgetTitle?: string;
    widgetHint?: string;
    /** Button that re-runs a failed widget. */
    retry?: string;
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
