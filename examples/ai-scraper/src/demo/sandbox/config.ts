export const SANDBOX_INACTIVITY_MS = 60 * 60_000;
export const SANDBOX_ABSOLUTE_MS = 24 * 60 * 60_000;

export type DemoSandboxConfig = Readonly<{
  publicMode: boolean;
  readOnly: boolean;
  trustProxy: boolean;
  secret: string | null;
  maxActive: number;
  maxCreatesPerHour: number;
  inactivityMs: number;
  absoluteMs: number;
  touchIntervalMs: number;
  cleanupIntervalMs: number;
}>;

type Env = Record<string, string | undefined>;

export function isEnabledFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function boundedPositiveInteger(env: Env, name: string, fallback: number, maximum: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

export function readSandboxConfig(env: Env = process.env): DemoSandboxConfig {
  const publicMode = isEnabledFlag(env.DEMO_MODE);
  const secret = env.DEMO_SANDBOX_SECRET?.trim() || null;
  if (publicMode && (!secret || secret.length < 32)) {
    throw new Error("DEMO_SANDBOX_SECRET must contain at least 32 characters in public demo mode");
  }

  return Object.freeze({
    publicMode,
    readOnly: isEnabledFlag(env.DEMO_READ_ONLY),
    trustProxy: isEnabledFlag(env.DEMO_TRUST_PROXY),
    secret,
    maxActive: boundedPositiveInteger(env, "DEMO_SANDBOX_MAX_ACTIVE", 200, 10_000),
    maxCreatesPerHour: boundedPositiveInteger(env, "DEMO_SANDBOX_MAX_CREATES_PER_HOUR", 10, 1_000),
    inactivityMs: SANDBOX_INACTIVITY_MS,
    absoluteMs: SANDBOX_ABSOLUTE_MS,
    touchIntervalMs: 5 * 60_000,
    cleanupIntervalMs: 15 * 60_000,
  });
}
