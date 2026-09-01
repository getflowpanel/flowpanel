import type { RateLimitOptions } from "../runtime/rate-limit";
import type { Adapter } from "./adapter";
import type { CommandPaletteConfig } from "./command";
import type { ErrorContext } from "./context";
import type { DashboardConfig, PageConfig } from "./dashboard";
import type { LabelsConfig } from "./labels";
import type { AdminPaths, AdminPathsInput } from "./paths";
import type { QueueConfig } from "./queue";
import type { RealtimeConfig } from "./realtime";
import type { AnyResourceConfig, ResourceConfig } from "./resource";
import type { Scope, ScopeContext, Session } from "./session";

export type RateLimitConfig = RateLimitOptions & {
  per?: "user" | "ip";
  enabled?: boolean;
};

export interface AuthConfig {
  /**
   * Reads the current session. Called on every request and page render, and handed
   * the request being served so a provider that inspects headers, cookies or the
   * host — a tenant resolver, an OAuth callback check — does not have to forge one.
   */
  session: (req: Request) => Promise<Session | null>;
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
  /** Disable when the host application layout already renders a skip-to-content link. */
  skipLink?: boolean;
}

/** Browser request protections applied by the Next.js runtime. */
export interface SecurityConfig {
  /**
   * Reject cross-origin write requests using Origin and Fetch Metadata headers.
   * Enabled by default. Disable only when an upstream gateway enforces an equivalent policy.
   */
  sameOrigin?: boolean;
  /** Additional exact origins allowed to submit writes, for example `https://ops.example.com`. */
  trustedOrigins?: string[];
}

export interface AdminDefinition<
  Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
> {
  /** Stable id used in diagnostics, logs, and multi-admin deployments. */
  id?: string;
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
  resources?: Resources;
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
  /** Browser request protections. Same-origin mutation checks are enabled by default. */
  security?: SecurityConfig;
  /** Put the whole admin in read-only mode. */
  readOnly?: boolean;
  /** Mount points for the generated admin UI and HTTP API. */
  paths?: AdminPathsInput;
  /** @deprecated Use `paths.admin`. This alias will be removed in 0.3. */
  basePath?: string;
  /** Cross-cutting callbacks. */
  hooks?: {
    onError?: (err: Error, ctx: ErrorContext) => void | Promise<void>;
  };
}

/** @deprecated Prefer `AdminDefinition`. Kept as the 0.2 compatibility name. */
export interface AdminConfig<
  Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
> extends AdminDefinition<Resources> {}

export interface ResolvedAdminConfig<
  Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
> extends AdminConfig<Resources> {
  readonly __resolved: true;
  readonly resources: Resources;
  readonly resourcesByName: Map<string, ResourceConfig>;
  readonly dashboardsByPath: Map<string, DashboardConfig>;
  readonly pagesByPath: Map<string, PageConfig>;
  readonly queuesByKey: Map<string, QueueConfig>;
  /** Normalized `basePath` — leading slash, no trailing slash. Defaults to `/admin`. */
  readonly basePath: string;
  /** Normalized mount points with leading slashes and no trailing slash. */
  readonly paths: AdminPaths;
}
