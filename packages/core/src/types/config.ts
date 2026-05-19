import type { ComponentType } from "react";
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
  session: () => Promise<Session | null>;
  role: (session: Session | null) => string;
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
}

export interface ThemeConfig {
  brand?: { name?: string; logo?: string; href?: string };
  accent?: string;
  mode?: "light" | "dark" | "auto";
  cssVars?: Record<string, string>;
  components?: Record<string, ComponentType<any>>;
  nav?: { groups?: Array<{ label: string; items: string[] }> };
  user?: (s: Session | null) => {
    name?: string;
    email?: string;
    avatar?: string;
    items?: Array<{ label: string; href?: string; variant?: "default" | "destructive" }>;
    signOut?: string;
  };
}

export interface AuditEvent {
  actorId: string | null;
  action: string;
  resource?: string;
  targetId?: string;
  diff?: { before: unknown; after: unknown };
  ip?: string;
  userAgent?: string;
  at: Date;
}

export interface AuditConfig {
  enabled?: boolean;
  sink?: (event: AuditEvent) => Promise<void>;
  retention?: string;
}

/**
 * How FlowPanel renders surrounding chrome around the content area.
 *
 * - `sidebar` — full app shell with left sidebar nav + brand. The default;
 *   suited to standalone admins where FlowPanel owns the whole route.
 * - `tabs` — horizontal tab strip above content. Bare layout otherwise; suited
 *   to admins embedded under a host app's existing header.
 * - `bare` — no shell at all. Only the page content is rendered. The host
 *   app's `app/layout.tsx` (or a wrapper component) supplies all chrome.
 *   Globals (toasts, drawer host, command palette, realtime) still mount,
 *   so feature parity is preserved.
 */
export type ShellMode = "sidebar" | "tabs" | "bare";

export interface ShellConfig {
  mode?: ShellMode;
  /** Overrides `theme.brand`. `false` hides brand even in sidebar/tabs. */
  brand?: { name?: string; logo?: string; href?: string } | false;
}

export interface AdminConfig {
  adapter: Adapter;
  auth: AuthConfig;
  scope?: (ctx: ScopeContext) => Promise<Scope> | Scope;
  theme?: ThemeConfig;
  shell?: ShellConfig | ShellMode;
  labels?: LabelsConfig;
  resources?: ResourceConfig[];
  dashboards?: DashboardConfig[];
  pages?: PageConfig[];
  queues?: QueueConfig[];
  commandPalette?: CommandPaletteConfig;
  audit?: AuditConfig;
  realtime?: RealtimeConfig;
  rateLimit?: RateLimitConfig;
  hooks?: {
    onError?: (err: Error, ctx: RequestContext) => void | Promise<void>;
  };
}

export interface ResolvedAdminConfig extends AdminConfig {
  readonly __resolved: true;
  readonly resourcesByName: Map<string, ResourceConfig>;
  readonly dashboardsByPath: Map<string, DashboardConfig>;
  readonly queuesByKey: Map<string, QueueConfig>;
}
