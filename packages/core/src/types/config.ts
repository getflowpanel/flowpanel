import type { RateLimitOptions } from "../runtime/rate-limit.js";
import type { Adapter } from "./adapter.js";
import type { CommandPaletteConfig } from "./command.js";
import type { RequestContext } from "./context.js";
import type { DashboardConfig, PageConfig } from "./dashboard.js";
import type { LabelsConfig } from "./labels.js";
import type { QueueConfig } from "./queue.js";
import type { RealtimeConfig } from "./realtime.js";
import type { ResourceConfig } from "./resource.js";
import type { Scope, ScopeContext, Session } from "./session.js";

export type RateLimitConfig = RateLimitOptions & {
  per?: "user" | "ip";
  enabled?: boolean;
};

export interface AuthConfig {
  /** Reads the current session. Called on every request and page render. */
  session: () => Promise<Session | null>;
  /** Maps a session to a role string, which every `requireRole` gate compares against. */
  role: (session: Session | null) => string;
  /** Admin-wide gate. Blocks every route and page before anything else runs. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  /** Where to send an unauthenticated visitor. Without it they get an inline notice. */
  signInUrl?: string;
  /** Where to send a signed-in visitor who lacks the role. */
  forbiddenUrl?: string;
  /** Extracts the actor id for audit rows and per-user rate limiting. */
  userId?: (session: Session | null) => string | null;
  /**
   * Declares that this admin is meant to be reachable without any role gate —
   * a deployment already fronted by a VPN or an authenticating proxy. Silences
   * the development-only "no access control" warning and changes no runtime check.
   */
  allowUnauthenticated?: boolean;
}

/** Slot registry for L2 component overrides registered via `theme.components`. */
// biome-ignore lint/suspicious/noEmptyInterface: must stay an interface — @flowpanel/react and consumers augment it via `declare module` merging (I-11); a `type` alias cannot be merged into.
export interface FlowpanelComponentSlots {}

export interface ThemeConfig {
  /** Product name, logo and home link shown in the shell header. */
  brand?: { name?: string; logo?: string; href?: string };
  /** Accent color as an HSL triplet, e.g. `"220 90% 50%"`. An `hsl(…)` wrapper is unwrapped. */
  accent?: string;
  /**
   * Dark-mode accent override, same format as `accent`. Custom accents tuned
   * for light surfaces usually fail WCAG contrast on dark ones — pass a
   * re-lightened triplet here to keep both schemes accessible.
   */
  accentDark?: string;
  /** Initial color scheme. `"auto"` follows the operating system. */
  mode?: "light" | "dark" | "auto";
  /** Override any `--fp-*` design token, e.g. `{ "--fp-radius": "0.25rem" }`. */
  cssVars?: Record<string, string>;
  /** Replace built-in components. See the theme-slots guide. */
  components?: Partial<FlowpanelComponentSlots>;
  /**
   * What the account menu shows for the current session. Return `undefined` to
   * render no menu at all — the usual choice when there is no session.
   */
  user?: (s: Session | null) =>
    | {
        name?: string;
        email?: string;
        avatar?: string;
        items?: Array<{ label: string; href?: string; variant?: "default" | "destructive" }>;
        signOut?: string;
      }
    | undefined;
}

/** One record handed to `AuditConfig.sink`. */
export interface AuditEvent {
  /** Who acted, from `AuthConfig.userId`. Null when unresolvable. */
  actorId: string | null;
  /** What ran, e.g. `"orders.action.refund"` or `"orders.inline-update"`. */
  action: string;
  /** Resource name the action targeted. */
  resource?: string;
  /** Id of the affected row. Bulk actions carry the first ten, comma-joined. */
  targetId?: string;
  /** Before/after values, for mutations that can compute them. */
  diff?: { before: unknown; after: unknown };
  ip?: string;
  userAgent?: string;
  at: Date;
}

export interface AuditConfig {
  /** Turn auditing on. Individual resources can opt out with `audit: false`. */
  enabled?: boolean;
  /** Where events go — your table, your log pipeline, anywhere. */
  sink?: (event: AuditEvent) => Promise<void>;
  /** Advisory retention window for your own sink, e.g. `"90d"`. */
  retention?: string;
}

/** How FlowPanel renders surrounding chrome around the content area. */
export type ShellMode = "sidebar" | "tabs" | "bare";

export interface ShellConfig {
  mode?: ShellMode;
  /** Overrides `theme.brand`. `false` hides brand even in sidebar/tabs. */
  brand?: { name?: string; logo?: string; href?: string } | false;
}

export interface AdminConfig {
  /** Database binding — `drizzleAdapter`, `prismaAdapter`, or your own. */
  adapter: Adapter;
  /** How the admin reads sessions and roles. */
  auth: AuthConfig;
  /** Tenant scope resolved per request, then applied to every query. */
  scope?: (ctx: ScopeContext) => Promise<Scope> | Scope;
  /** Branding, color scheme, design tokens and component overrides. */
  theme?: ThemeConfig;
  /** Chrome around the content area — sidebar, tabs, or none. */
  shell?: ShellConfig | ShellMode;
  /** Override built-in UI strings. */
  labels?: LabelsConfig;
  /** Tables the admin manages. */
  resources?: ResourceConfig[];
  /** Widget dashboards. */
  dashboards?: DashboardConfig[];
  /** Custom pages rendered inside the shell. */
  pages?: PageConfig[];
  /** BullMQ queues surfaced in the admin. */
  queues?: QueueConfig[];
  /** What ⌘K offers. */
  commandPalette?: CommandPaletteConfig;
  /** Audit trail for every mutation. */
  audit?: AuditConfig;
  /** Cross-instance realtime transport. Redis in production. */
  realtime?: RealtimeConfig;
  /** Throttle requests per user or per IP. */
  rateLimit?: RateLimitConfig;
  /** Put the whole admin in read-only mode. */
  readOnly?: boolean;
  /** URL prefix under which the admin is mounted. */
  basePath?: string;
  /** Cross-cutting callbacks. */
  hooks?: {
    onError?: (err: Error, ctx: RequestContext) => void | Promise<void>;
  };
}

export interface ResolvedAdminConfig extends AdminConfig {
  readonly __resolved: true;
  readonly resourcesByName: Map<string, ResourceConfig>;
  readonly dashboardsByPath: Map<string, DashboardConfig>;
  readonly pagesByPath: Map<string, PageConfig>;
  readonly queuesByKey: Map<string, QueueConfig>;
  /** Normalized `basePath` — leading slash, no trailing slash. Defaults to `/admin`. */
  readonly basePath: string;
}
