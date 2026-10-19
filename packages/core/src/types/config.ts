import type { RateLimitOptions } from "../runtime/rate-limit";
import type { Adapter } from "./adapter";
import type { AuditConfig, AuditLogStore } from "./audit";
import type { CommandPaletteConfig } from "./command";
import type { ErrorContext } from "./context";
import type { DashboardConfig, PageConfig } from "./dashboard";
import type { FormattingConfig } from "./formatting";
import type { LabelsConfig } from "./labels";
import type { AdminPaths, AdminPathsInput } from "./paths";
import type { AccessRule } from "./policy";
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
   * Reads the current session. Called on every request and page render, handed the request being served.
   * Lets a provider inspect headers, cookies or the host without forging one.
   */
  session: (req: Request) => Promise<Session | null>;
  /** Maps a session to a role string, which every role-name `access` rule compares against. */
  role: (session: Session | null) => string | Promise<string>;
  /**
   * Who may enter the admin at all. Checked on every route and page before anything else runs,
   * so a predicate sees `scope` as `null`.
   */
  access?: AccessRule;
  /** Where to send an unauthenticated visitor. Without it they get an inline notice. */
  signInUrl?: string;
  /** Where to send a signed-in visitor `access` keeps out of the whole admin; a page one role may not open shows its own screen. */
  forbiddenUrl?: string;
  /** Extracts the actor id for audit rows and per-user rate limiting. */
  userId?: (session: Session | null) => string | null;
  /**
   * Declares this admin reachable without a role gate — fronted by a VPN or authenticating proxy instead.
   * Production refuses to start without `access` unless this is `true` AND the admin is `readOnly`.
   */
  allowUnauthenticated?: boolean;
}

/** Component slots a host can override through `theme.components`. */
// biome-ignore lint/suspicious/noEmptyInterface: must stay an interface — @flowpanel/react and consumers augment it via `declare module` merging; a `type` alias cannot be merged into.
export interface FlowpanelComponentSlots {}

/** A design token FlowPanel's stylesheet reads. Colours hold a bare HSL triplet. */
export type FlowpanelToken =
  | "--fp-bg-1"
  | "--fp-bg-2"
  | "--fp-bg-3"
  | "--fp-text-1"
  | "--fp-text-2"
  | "--fp-text-3"
  | "--fp-border-1"
  | "--fp-border-2"
  | "--fp-accent"
  | "--fp-accent-text"
  | "--fp-accent-badge-text"
  | "--fp-ring"
  | "--fp-overlay"
  | "--fp-data"
  | "--fp-ok"
  | "--fp-warn"
  | "--fp-err"
  | "--fp-info"
  | "--fp-ok-text"
  | "--fp-warn-text"
  | "--fp-err-text"
  | "--fp-info-text"
  | "--fp-chart-1"
  | "--fp-chart-2"
  | "--fp-chart-3"
  | "--fp-chart-4"
  | "--fp-chart-5"
  | "--fp-chart-6"
  | "--fp-chart-7"
  | "--fp-shadow-color"
  | "--fp-radius-sm"
  | "--fp-radius"
  | "--fp-radius-lg"
  | "--fp-radius-xl"
  | "--fp-font-sans"
  | "--fp-font-mono";

/** Token overrides: the known names complete in an editor, any other `--fp-*` still passes. */
export type ThemeTokens = { [Name in FlowpanelToken]?: string } & Record<string, string>;

export interface ThemeConfig {
  /** Product name, logo and home link shown in the shell header. */
  brand?: { name?: string; logo?: string; href?: string };
  /**
   * Accent color: any CSS colour as hex or a colour function, `oklch(…)` included, or an HSL triplet such as `"220 90% 50%"`.
   * Data fills take it too unless `cssVars` sets `--fp-data`.
   */
  accent?: string;
  /**
   * Dark-mode accent override, same format as `accent`; a light-tuned accent usually fails WCAG contrast on dark.
   * Dark data fills take it too unless `cssVarsDark` sets `--fp-data`.
   */
  accentDark?: string;
  /**
   * Initial color scheme. `"auto"` follows the operating system. `"host"` follows the host app instead:
   * the admin is dark while `<html>` has the class `dark`, as shadcn and next-themes set it, and the
   * palette's theme switch is left out because the host's own switch drives it.
   */
  mode?: "light" | "dark" | "auto" | "host";
  /** Override any `--fp-*` design token, e.g. `{ "--fp-radius": "0.25rem" }`. */
  cssVars?: ThemeTokens;
  /**
   * Dark-mode token overrides, scoped to FlowPanel's dark roots and portals.
   * Choose foreground tokens for contrast against the actual dark background.
   */
  cssVarsDark?: ThemeTokens;
  /** Replace built-in components. See the styling guide. */
  components?: Partial<FlowpanelComponentSlots>;
  /**
   * What the account menu shows for the current session. Return `undefined` to
   * render no menu at all — the usual choice when there is no session.
   */
  user?: (s: Session | null) =>
    | {
        /** `null` or `undefined` shows nothing, so an auth library's nullable fields pass straight through. */
        name?: string | null | undefined;
        email?: string | null | undefined;
        avatar?: string | null | undefined;
        items?: Array<{ label: string; href?: string; variant?: "default" | "destructive" }>;
        signOut?: string;
      }
    | undefined;
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
  /**
   * How many proxies in front of the app append to `X-Forwarded-For`; `ctx.ip` is the entry the outermost one wrote.
   * `1` for Vercel, a single nginx, or Cloudflare straight to the app; `2` for Cloudflare in front of nginx.
   * With `0`, `ctx.ip` is `null`, because every header could come from the client.
   * `ctx.ip` is for logs and rate limits, not for deciding who may sign in.
   * @defaultValue 0
   */
  trustedProxies?: number;
}

export interface AdminDefinition<
  Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
> {
  /** Stable id surfaced in the wire client metadata (`client.id`, default `"local"`) to tell multi-admin deployments apart. */
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
  /** Locale, timezone and currency for numbers, money and timestamps. */
  formatting?: FormattingConfig;
  /** Tables the admin manages. */
  resources?: Resources;
  /** Widget dashboards. A `page()` goes in `pages`. */
  dashboards?: (DashboardConfig | MisplacedPage)[];
  /** Custom pages rendered inside the shell: `pages: [page({ path, label, component })]`. */
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
  /** Cross-cutting callbacks. */
  hooks?: {
    onError?: (err: Error, ctx: ErrorContext) => void | Promise<void>;
  };
}

/** No value has this type: TypeScript names its key when a `page()` lands in `dashboards`. */
interface MisplacedPage {
  kind: "page";
  "a page() is registered in pages: [...], not dashboards": never;
}

export interface ResolvedAdminConfig<
  Resources extends readonly AnyResourceConfig[] = readonly AnyResourceConfig[],
> extends AdminDefinition<Resources> {
  readonly __resolved: true;
  readonly resources: Resources;
  readonly dashboards?: DashboardConfig[];
  readonly resourcesByName: Map<string, ResourceConfig>;
  readonly dashboardsByPath: Map<string, DashboardConfig>;
  readonly pagesByPath: Map<string, PageConfig>;
  readonly queuesByKey: Map<string, QueueConfig>;
  /** Normalized mount points with leading slashes and no trailing slash. */
  readonly paths: AdminPaths;
  /** The table History tabs and the Audit log page read; null when audit is off or a `sink` replaces it. */
  readonly auditLog: AuditLogStore | null;
  /** Config problems that do not stop the admin from booting. `flowpanel doctor` prints them; development prints each once. */
  readonly warnings: readonly string[];
}
