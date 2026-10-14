import type {
  AuditLabels,
  FormLabels,
  ImporterLabels,
  RealtimeLabels,
  SavingLabels,
  ShortcutsLabels,
  TableLabels,
} from "./chrome-labels";
import type { AccessLabels, ErrorLabels, NotFoundLabels } from "./wall-labels";
import type { ChecklistLabels, HeatmapLabels, TimelineLabels, WidgetLabels } from "./widget-labels";

/**
 * A count template per `Intl.PluralRules` category of the admin's locale; a missing category falls back to `other`.
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
  navigation?: {
    /** The breadcrumb trail above a page heading. */
    breadcrumb?: string;
    /** The tab row of queue boards. */
    queueBoards?: string;
    /** A queue board frame. Use `{label}` for the queue. */
    queueBoard?: string;
    /** The region toasts appear in. */
    notifications?: string;
    /** A toast's close button. */
    closeNotification?: string;
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
    /** The menu holding the nav tabs that do not fit. */
    more?: string;
  };
  table?: TableLabels;
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
    last12m?: string;
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
    /** A select or boolean filter's "any value" choice. */
    allOption?: string;
    /** A tag filter's example input. */
    tagsPlaceholder?: string;
    /** A number range filter's lower bound. */
    min?: string;
    max?: string;
    /** Empties the list search. */
    clearSearch?: string;
    label?: string;
    clear?: string;
    yes?: string;
    no?: string;
    searchPlaceholder?: string;
    /** The phone button that opens the filters. Use `{n}` for the active ones; `open` when none are. */
    open?: string;
    openCount?: string;
    /** Closes the phone filter sheet. */
    done?: string;
  };
  /** Bulk action bar. */
  bulkBar?: {
    /** The bulk action toolbar. */
    label?: string;
    /** The bulk action picker before a choice. */
    choose?: string;
    /** Clears the selection. */
    clearSelection?: string;
    /** Use `{n}` for the selection count. Default: `"{n} selected"`. */
    selected?: string;
    clear?: string;
  };
  /** Count templates per `Intl.PluralRules` category; when set, they win over `table.result`/`results` and `bulkBar.selected`. */
  plurals?: {
    /** The table's row count, every count `1` included. */
    results?: PluralLabel;
    /** The bulk bar's and a multi-select filter's selection count. */
    selected?: PluralLabel;
    /** A timeline day's event count; wins over `timeline.event`/`timeline.events`. */
    events?: PluralLabel;
  };
  /** Generic action buttons. */
  actions?: {
    /** A bulk action's confirm title when it names none. Use `{label}`. */
    runConfirm?: string;
    /** A bulk action that succeeded. Use `{label}` and `{n}`. */
    ranOn?: string;
    /** An action that succeeded without a message of its own. Use `{label}`. */
    ran?: string;
    edit?: string;
    save?: string;
    cancel?: string;
    delete?: string;
    restore?: string;
    new?: string;
    create?: string;
    export?: string;
    import?: string;
    /** The menu holding a record's actions on its page and in its drawer. */
    more?: string;
    /** A bulk delete that stopped part way. Use `{done}` and `{total}`. */
    deletedSome?: string;
  };
  /** Generated create and edit form chrome. */
  form?: FormLabels;
  /** Drawer chrome. */
  drawer?: {
    close?: string;
    viewDetails?: string;
    /** While the record loads. */
    loading?: string;
    /** A resource tab with no rows. Use `{resource}`. */
    noRows?: string;
    /** A widgets tab that declares none. */
    noWidgets?: string;
    /** A chart, which only a dashboard or a record page draws. Use `{n}` for its points. */
    chartElsewhere?: string;
    /** A widget kind a drawer does not draw. Use `{kind}`. */
    unsupported?: string;
    /** The dialog's name before the record loads. */
    title?: string;
    /** The record could not be loaded. */
    loadFailed?: string;
    /** The record is gone, or the reader may not see it. */
    missing?: string;
  };
  /** Full-page detail chrome. */
  detail?: {
    /** The fields tab a record gets beside History when it declares no tabs of its own. */
    details?: string;
    /** A fields tab with nothing the reader is allowed to see. */
    noFields?: string;
    /** A tab naming a resource that is not registered. Use `{resource}`. */
    unknownResource?: string;
    /** A counted tab's label. Use `{label}` and `{count}`. */
    tabCount?: string;
    /** A soft-deleted record opened by someone who may restore it. Use `{label}` for the singular label. */
    deleted?: string;
    deletedDescription?: string;
  };
  /** Related detail-tab chrome. */
  related?: {
    /** Link from a related tab to the target resource's own list. */
    openList?: string;
  };
  /** The admin's own not-found page, for a URL no resource or dashboard matches. */
  notFound?: NotFoundLabels;
  /** The screens shown in place of a page when `auth.signInUrl` or `auth.forbiddenUrl` is not set, or the rate limit refuses it. */
  access?: AccessLabels;
  /** Confirm dialog. */
  confirm?: {
    /** The built-in bulk delete's confirm title. */
    deleteSelectedTitle?: string;
    title?: string;
    ok?: string;
    cancel?: string;
    /** Deleting one record. Use `{label}` for the resource's singular label. */
    deleteTitle?: string;
    /** Under `deleteTitle` when the delete is permanent and `delete.confirm` is not set. */
    deleteDescription?: string;
    /** Under `deleteTitle` when the resource soft-deletes and `delete.confirm` is not set. */
    softDeleteDescription?: string;
  };
  /** Dashboard and detail-tab widget chrome. */
  widget?: WidgetLabels;
  /** `timeline()` chrome. */
  timeline?: TimelineLabels;
  /** `heatmap()` chrome. */
  heatmap?: HeatmapLabels;
  /** `checklist()` chrome. */
  checklist?: ChecklistLabels;
  /** FlowPanel's own failure surfaces, shown in place of the data that did not load. */
  errors?: ErrorLabels;
  /** ⌘K palette. */
  palette?: {
    /** The palette's result list. */
    suggestions?: string;
    placeholder?: string;
    noResults?: string;
    title?: string;
    description?: string;
    loading?: string;
  };
  /** What a create or edit form says after it saves, and when it would lose typed changes. */
  saving?: SavingLabels;
  /** The list's file import. */
  importer?: ImporterLabels;
  /** The `?` keyboard cheat sheet. */
  shortcuts?: ShortcutsLabels;
  /** A live list's or widget's connection badge. */
  realtime?: RealtimeLabels;
  /** The record History tab and the Audit log page. */
  audit?: AuditLabels;
}
