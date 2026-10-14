/** FlowPanel's own failure surfaces, shown in place of the data that did not load. */
export interface ErrorLabels {
  /** `ErrorState` without a title. */
  title?: string;
  /** A list or related tab that could not load. Use `{label}` for the resource's name. */
  loadTitle?: string;
  /** A record that could not load. Use `{label}` for the resource's singular name. */
  loadRecordTitle?: string;
  /** What a developer checks after a failed page read, shown outside production only. */
  queryHint?: string;
  /** What a developer checks when the database refused the connection, shown outside production only. */
  connectionHint?: string;
  /** What a failed list or record read asks the reader to do. */
  loadHint?: string;
  /** Under a failure that carries a request ID: who to send it to. */
  reportHint?: string;
  /** A widget failure's ID, the digest the server log prints. Use `{id}`. */
  digest?: string;
  /** An action the server refused or never answered. Use `{label}` for the action. */
  actionFailed?: string;
  /** The button that copies a failure's request ID. */
  copyId?: string;
  /** Said once the ID is on the clipboard. */
  copied?: string;
  /** Correlation line tying the card to the server log. Use `{id}`. */
  requestId?: string;
  /** Failed widget, shown in the widget's own frame. */
  widgetTitle?: string;
  widgetHint?: string;
  /** Button that re-runs a failed widget. */
  retry?: string;
  /** Disclosure holding the error's own message, outside production only. */
  details?: string;
  /** A request the browser could not send because it is offline. */
  offline?: string;
  /** A request that never reached the server. */
  network?: string;
  /** A write whose row is gone, or whose action no longer applies to it. */
  notFound?: string;
  /** A write the reader's role may not make. */
  forbidden?: string;
  /** A write after the session ended. */
  signedOut?: string;
  /** A write the admin turns off: a read-only admin or a disabled operation. */
  readOnly?: string;
  /** A write the rate limit refused. */
  rateLimited?: string;
  /** A request body over the size limit. */
  tooLarge?: string;
  /** A bulk action over its `max`. Use `{max}`. */
  tooManySelected?: string;
  /** A row action whose `disabled` returned `true` for this row. */
  notApplicable?: string;
}

/** The admin's own not-found page, for a URL no resource or dashboard matches. */
export interface NotFoundLabels {
  title?: string;
  description?: string;
  back?: string;
  /** The way back to a list. Use `{label}` for its name. */
  backTo?: string;
  /** A record URL whose row is gone. Use `{label}` for the resource's singular label. */
  record?: string;
  recordDescription?: string;
}

/** The screens shown in place of a page when `auth.signInUrl` or `auth.forbiddenUrl` is not set, or the rate limit refuses it. */
export interface AccessLabels {
  /** No session: the reader has to sign in. */
  signInTitle?: string;
  signInDescription?: string;
  /** A session whose role the admin does not allow. */
  deniedTitle?: string;
  deniedDescription?: string;
  /** One dashboard, page, queue or resource the role may not open. Use `{label}` for its name. */
  deniedSectionTitle?: string;
  deniedSectionDescription?: string;
  /** The way out of a refused page. Use `{label}` for where it leads. */
  back?: string;
  /** Sends a refused reader to `auth.signInUrl` to sign in as someone else. */
  switchAccount?: string;
  /** Reloads the page after the reader signed in elsewhere. */
  reload?: string;
  /** `rateLimit` refused the page. */
  rateLimitedTitle?: string;
  rateLimitedDescription?: string;
}
