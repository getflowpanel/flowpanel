import type { AccessRule } from "./policy";
import type { Scope } from "./session";

/** One record of a change, handed to `AuditConfig.sink` or written to `flowpanel_audit_log`. */
export interface AuditEvent {
  /** Who acted, from `AuthConfig.userId`. Null when unresolvable. */
  actorId: string | null;
  /** The actor's display name or email, from `theme.user`, when the admin shows one. */
  actorName?: string;
  /** What ran, e.g. `"orders.action.refund"` or `"orders.inline-update"`. */
  action: string;
  /** Resource name the action targeted. */
  resource?: string;
  /** Id of the affected row. Bulk actions carry the first ten, comma-joined. */
  targetId?: string;
  /** Every affected id of a bulk action. */
  targetIds?: readonly string[];
  /** Before/after values of the changed, readable, non-sensitive fields. */
  diff?: { before: unknown; after: unknown };
  /** The tenant the request was scoped to, when the admin has a `scope`. */
  scope?: Exclude<Scope, null>;
  ip?: string;
  userAgent?: string;
  at: Date;
}

export interface AuditConfig {
  /**
   * Turn auditing on. Individual resources can opt out with `audit: false`.
   * @defaultValue true once `audit` is set
   */
  enabled?: boolean;
  /**
   * Sends events somewhere else instead of the `flowpanel_audit_log` table.
   * The admin cannot read them back, so it shows no History tab and no Audit log page.
   */
  sink?: (event: AuditEvent) => Promise<void>;
  /**
   * Who sees the Audit log page and the History tab on records.
   * @defaultValue everyone `auth.access` lets into the admin
   */
  access?: AccessRule;
}

/** One stored audit event. From `list`, each long value in `diff` is cut to its start; `entry` reads it whole. */
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  resource: string | null;
  targetId: string | null;
  diff: { before: unknown; after: unknown } | null;
  /** From `list`: the diff predates previews and was too large to copy; `diff` names its fields with empty previews. */
  diffTooLarge?: boolean;
  at: Date;
}

/** The events a reader may see: those of `resources`, the dashboard actions in `actions`, and other events without a resource. */
export interface AuditLogVisibility {
  resources: readonly string[];
  actions: readonly string[];
}

/** Which stored events to read, newest first. */
export interface AuditLogQuery {
  /** Present when the admin is scoped: only events written under this tenant key. */
  scope?: { key: string | null };
  /** Present when the reader may not see every resource. */
  visible?: AuditLogVisibility;
  /** One event by its stored id. */
  id?: string;
  resource?: string;
  targetId?: string;
  actorId?: string;
  action?: string;
  /** Inclusive lower bound. */
  from?: Date;
  /** Exclusive upper bound. */
  to?: Date;
  limit: number;
  offset: number;
}

/** One page of events. `total` stops counting at 10,000; `capped` says it did. */
export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  capped: boolean;
}

/** The values the Audit log page offers as filters. */
export interface AuditLogFacets {
  actors: Array<{ id: string; name: string | null }>;
  actions: string[];
}

/** The `flowpanel_audit_log` table, as an adapter exposes it. */
export interface AuditLogStore {
  append(event: AuditEvent): Promise<void>;
  /** A page of events with their bounded diff previews, never the whole stored diffs. */
  list(query: AuditLogQuery): Promise<AuditLogPage>;
  /** One event, `id` set, with its whole diff, under the same `scope` and `visible` bounds as `list`. */
  entry(query: Pick<AuditLogQuery, "scope" | "visible" | "id">): Promise<AuditLogEntry | null>;
  /** Who acted and what ran among the events `query` selects, newest actors first. */
  facets(query: Pick<AuditLogQuery, "scope" | "visible" | "from">): Promise<AuditLogFacets>;
}
