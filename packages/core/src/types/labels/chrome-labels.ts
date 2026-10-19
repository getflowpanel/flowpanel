import type { PluralLabel } from "./config";

/** What a create or edit form says after it saves, and when it would lose typed changes. */
export interface SavingLabels {
  /** After a create. Use `{label}` for the resource's singular label. */
  created?: string;
  /** After an edit. */
  saved?: string;
  /** After a record's Delete. Use `{label}` for the resource's singular label. */
  deleted?: string;
  unsavedTitle?: string;
  unsavedDescription?: string;
  discard?: string;
  keepEditing?: string;
}

/** The list's file import. */
export interface ImporterLabels {
  /** A JSON row that is not an object. */
  notObject?: string;
  /** Use `{file}` for the file name. */
  confirmTitle?: string;
  /** How many rows the file holds. */
  rows?: string | PluralLabel;
  /** The file's columns the import does not read. Use `{n}` and `{columns}`. */
  skipped?: string | PluralLabel;
  confirm?: string;
  importing?: string;
  /** Use `{formats}` for the accepted extensions. */
  unsupported?: string;
  unreadable?: string;
  empty?: string;
  failed?: string;
  doneTitle?: string;
  imported?: string | PluralLabel;
  rejected?: string | PluralLabel;
  /** A failed row's number in the file. Use `{n}`. */
  row?: string;
  download?: string;
  /** Under the first refused rows when there are more. Use `{n}`. */
  more?: string;
  close?: string;
}

/** The `?` keyboard cheat sheet. */
export interface ShortcutsLabels {
  title?: string;
  /** The hint under a list. */
  hint?: string;
  or?: string;
  navigation?: string;
  rows?: string;
  general?: string;
  moveDown?: string;
  /** Shift+← and Shift+→ on a focused column header. */
  columnWidth?: string;
  /** Shift+Enter on a focused column header. */
  columnFit?: string;
  moveUp?: string;
  first?: string;
  last?: string;
  open?: string;
  edit?: string;
  delete?: string;
  search?: string;
  palette?: string;
  show?: string;
  close?: string;
}

/** A live list's or widget's connection badge. */
export interface RealtimeLabels {
  idle?: string;
  connecting?: string;
  live?: string;
  reconnecting?: string;
  offline?: string;
}

/** The record History tab and the Audit log page. */
export interface AuditLabels {
  /** Under a list that stopped counting. Use `{n}`. */
  capped?: string;
  /** The History tab on a record. */
  history?: string;
  /** The Audit log page's heading and nav entry. */
  title?: string;
  description?: string;
  /** No events yet. */
  empty?: string;
  /** No event matches the filters. */
  emptyFiltered?: string;
  /** Filter labels. */
  actor?: string;
  resource?: string;
  action?: string;
  date?: string;
  /** An event whose actor the admin could not tell. */
  unknownActor?: string;
  created?: string;
  updated?: string;
  deleted?: string;
  restored?: string;
  exported?: string;
  /** A row, bulk or drawer action, or a dashboard action. Use `{action}` for its label. */
  ran?: string;
  /** The record an event changed. Use `{label}` for the resource's singular label and `{id}` for the record. */
  record?: string;
  /** Read out for the value before and after a change. */
  before?: string;
  after?: string;
  /** A value that was empty. */
  emptyValue?: string;
  /** An action filter option. Use `{resource}` and `{action}`. */
  actionOption?: string;
  /** After the start of a long value; expands it in place. */
  showFullValue?: string;
  /** Folds an expanded value back to its start. */
  showLess?: string;
  /** Under a long value whose full text could not be loaded. */
  fullValueFailed?: string;
  /** Above the fields of an old event whose diff was stored before previews and is too large to show inline. */
  changesTooLarge?: string;
  /** An old event too large to preview, none of whose fields this reader may see. */
  noReadableChanges?: string;
  /** Beside two long values that start alike. Use `{n}`. */
  characters?: string | PluralLabel;
}

/** The list table's chrome. */
export interface TableLabels {
  /** A list, related tab or picker with no rows. */
  noResults?: string;
  /** The list's search box. Use `{label}` for the resource's label. */
  searchPlaceholder?: string;
  /** A column's resize handle. */
  resizeColumn?: string;
  /** The column visibility menu. */
  columns?: string;
  /** A column's pin menu. Use `{label}` for the column. */
  columnOptions?: string;
  /** The columns menu item that shows every hidden column again. */
  showAllColumns?: string;
  /** The columns menu item that drops every width the reader dragged. */
  resetWidths?: string;
  /** Read out after a keyboard resize. Use `{label}` for the column and `{width}` for its px. */
  columnResized?: string;
  pinLeft?: string;
  pinRight?: string;
  unpin?: string;
  /** Opens a JSON cell. */
  viewJson?: string;
  /** The density switch. Use `{current}` and `{next}`. */
  density?: string;
  compact?: string;
  comfortable?: string;
  /** The soft-deleted rows toggle. */
  showDeleted?: string;
  hideDeleted?: string;
  exportCsv?: string;
  exportJson?: string;
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
  /** The screen-reader name of a list cell. Use `{n}` and `{list}`. */
  arrayItems?: string;
  /** Title of a list with no rows and no `emptyState`. Use `{label}` for the plural label. */
  empty?: string;
  /** Under `empty` when the reader may create rows. Use `{label}` for the plural label. */
  emptyDescription?: string;
  /** Under `empty` when nobody creates rows here. Use `{label}` for the plural label. */
  emptyReadOnlyDescription?: string;
  /** A list a search alone left empty; `{query}` is the search. */
  noSearchMatch?: string;
  /** The empty state when the list's default filters alone hide every row. */
  noDefaultMatch?: string;
  /** The empty list's create button. Use `{label}` for the singular label. */
  createFirst?: string;
  /** The pencil on an editable cell. Use `{label}` for the column label. */
  editCell?: string;
  /** After an editable cell saves. */
  saved?: string;
  /** A phone card's link. Use `{title}` for the record, with its kind when the list has one: "run 36". */
  openRow?: string;
  /** An export that stopped at `export.maxRows`. Use `{n}` for the row count. */
  exportCapped?: string;
  /** An export the server refused or that did not arrive. */
  exportFailed?: string;
  /** Read out while a list loads the rows a search, filter, sort or page change asked for. */
  loading?: string;
}

/** Generated create and edit form chrome. */
export interface FormLabels {
  /** The banner when a submit fails with no field error of its own. */
  error?: string;
  /** A reference picker before a choice. */
  referencePlaceholder?: string;
  /** Beside the submit while a form's code is still loading and it takes no input yet. */
  loading?: string;
  /** A tags control's input. */
  tagPlaceholder?: string;
  /** A tag's remove button. Use `{tag}`. */
  removeTag?: string;
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
  /** A `money` value that is not an amount. Use `{label}` and `{example}`. */
  invalidMoney?: string;
  /** A `money` amount with more decimals than its currency keeps, typed or already stored. Use `{label}` and `{example}`. */
  moneyTooPrecise?: string;
  /** A value that is neither true nor false. Use `{label}`. */
  invalidBoolean?: string;
  /** A value that is not a date. Use `{label}`. */
  invalidDate?: string;
  /** A `type: "email"` value that is not an email address. Use `{label}`. */
  invalidEmail?: string;
  /** A `type: "url"` value that is not a full web address. Use `{label}`. */
  invalidUrl?: string;
  /** A `type: "color"` value that is not a `#rrggbb` colour. Use `{label}`. */
  invalidColor?: string;
  /** A `type: "time"` value that is not a time of day. Use `{label}`. */
  invalidTime?: string;
  /** A value a unique column already holds. Use `{label}`. */
  taken?: string;
  /** A unique violation the database did not tie to one column. */
  conflict?: string;
  /** A reference to a row that does not exist. Use `{label}`. */
  missingReference?: string;
  /** A choice the form did not offer this user. Use `{label}`. */
  invalidOption?: string;
  /** A foreign key violation the database did not tie to one column. */
  missingLink?: string;
  /** A delete that other rows still reference. */
  inUse?: string;
  /** The create page of a resource with `create.disabled`. */
  createDisabled?: string;
  /** The edit page of a resource with `update.disabled`. */
  editDisabled?: string;
}
