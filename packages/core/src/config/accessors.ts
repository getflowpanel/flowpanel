import type { FlowPanelConfig } from "./schema.js";

// These accessors centralize the type casts needed to access optional config
// sections. The Zod schema makes all sections optional, so TypeScript can't
// narrow them without casts. By putting casts here, the rest of the codebase
// stays clean.

interface SecurityAuthConfig {
  getSession: (req: Request) => Promise<{ userId: string; role: string } | null>;
  requireRole?: string;
  sessionMaxAge?: string;
  stepUpForDestructive?: boolean;
  stepUpVerify?: (...args: unknown[]) => Promise<boolean>;
}

interface SecurityConfig {
  auth: SecurityAuthConfig;
  permissions?: Record<string, { read: string[]; write: string[] }>;
  rowLevel?: {
    filter: (
      session: { userId: string; role: string },
      opts: Record<string, unknown>,
    ) => { partitionKey?: string } | null;
  };
  rateLimits?: Record<string, { perMinute?: number; perHour?: number }>;
  auditLog?: { retentionDays: number };
  redaction?: { keys: string[] };
}

interface DrawerConfig {
  title: string | ((run: Record<string, unknown>) => string);
  sections: Array<{
    type: string;
    field?: string;
    groupBy?: string;
    stats?: string[];
    fields?: string[];
    limit?: number;
    when?: ((run: Record<string, unknown>) => boolean) | string;
  }>;
  actions?: Array<{
    label: string;
    onClick: string;
    variant?: "default" | "danger";
    when?: (run: Record<string, unknown>) => boolean;
  }>;
}

interface UsersConfig {
  source: string;
  primaryKey: string;
  periodStart?: string;
  periodEnd?: string;
  columns?: Array<{ field: string; label: string }>;
}

interface StreamConfig {
  maxConnections?: number;
  heartbeatInterval?: string;
  replayWindow?: string;
  fallbackPollingInterval?: string;
}

export function getSecurity(config: FlowPanelConfig): SecurityConfig {
  return config.security as unknown as SecurityConfig;
}

export function getDrawer(config: FlowPanelConfig, id: string): DrawerConfig | undefined {
  return (config as Record<string, unknown>).drawers
    ? ((config as Record<string, unknown>).drawers as Record<string, DrawerConfig>)[id]
    : undefined;
}

export function getDrawers(config: FlowPanelConfig): Record<string, DrawerConfig> | undefined {
  return (config as Record<string, unknown>).drawers as Record<string, DrawerConfig> | undefined;
}

export function getUsers(config: FlowPanelConfig): UsersConfig | undefined {
  return (config as Record<string, unknown>).users as UsersConfig | undefined;
}

export function getMetrics(config: FlowPanelConfig): Record<string, unknown> | undefined {
  return (config as Record<string, unknown>).metrics as Record<string, unknown> | undefined;
}

export function getRunLogSearch(
  config: FlowPanelConfig,
): { fields: string[]; debounceMs: number; minLength: number } | undefined {
  return ((config as Record<string, unknown>).runLog as Record<string, unknown> | undefined)
    ?.search as { fields: string[]; debounceMs: number; minLength: number } | undefined;
}

export function getStreamConfig(config: FlowPanelConfig): StreamConfig | undefined {
  return ((config as Record<string, unknown>).ui as Record<string, unknown> | undefined)?.stream as
    | StreamConfig
    | undefined;
}

export function getPipelineOnRetry(
  config: FlowPanelConfig,
): ((run: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<void>) | undefined {
  return (config.pipeline as Record<string, unknown>).onRetry as
    | ((run: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<void>)
    | undefined;
}

export function getStageColors(config: FlowPanelConfig): Record<string, string> | undefined {
  return config.pipeline.stageColors;
}
