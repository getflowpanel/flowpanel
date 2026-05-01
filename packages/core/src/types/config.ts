import type { ComponentType } from "react";
import type { Adapter } from "./adapter.js";
import type { CommandPaletteConfig } from "./command.js";
import type { RequestContext } from "./context.js";
import type { DashboardConfig, PageConfig } from "./dashboard.js";
import type { ResourceConfig } from "./resource.js";
import type { Scope, ScopeContext, Session } from "./session.js";

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

export interface AdminConfig {
  adapter: Adapter;
  auth: AuthConfig;
  scope?: (ctx: ScopeContext) => Promise<Scope> | Scope;
  theme?: ThemeConfig;
  resources?: ResourceConfig[];
  dashboards?: DashboardConfig[];
  pages?: PageConfig[];
  commandPalette?: CommandPaletteConfig;
  audit?: AuditConfig;
  hooks?: {
    onError?: (err: Error, ctx: RequestContext) => void | Promise<void>;
  };
}

export interface ResolvedAdminConfig extends AdminConfig {
  readonly __resolved: true;
  readonly resourcesByName: Map<string, ResourceConfig>;
  readonly dashboardsByPath: Map<string, DashboardConfig>;
}
