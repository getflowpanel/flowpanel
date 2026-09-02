import type { DemoSandboxConfig } from "./config";

export class SandboxCapacityError extends Error {
  override name = "SandboxCapacityError";
}

export class SandboxCreationRateLimitError extends Error {
  override name = "SandboxCreationRateLimitError";
}

export class SandboxResetRateLimitError extends Error {
  override name = "SandboxResetRateLimitError";
}

export function nextDeadlines(createdAt: Date, now: Date, config: DemoSandboxConfig) {
  return {
    inactivityExpiresAt: new Date(now.getTime() + config.inactivityMs),
    absoluteExpiresAt: new Date(createdAt.getTime() + config.absoluteMs),
  };
}

export function shouldTouch(
  lastSeenAt: Date,
  now: Date,
  config: Pick<DemoSandboxConfig, "touchIntervalMs">,
): boolean {
  return now.getTime() - lastSeenAt.getTime() >= config.touchIntervalMs;
}

export function canReset(lastResetAt: Date | null, now: Date, cooldownMs = 5_000): boolean {
  return lastResetAt === null || now.getTime() - lastResetAt.getTime() >= cooldownMs;
}

export function assertCreationAllowed({
  active,
  recentForFingerprint,
  config,
}: {
  active: number;
  recentForFingerprint: number;
  config: Pick<DemoSandboxConfig, "maxActive" | "maxCreatesPerHour">;
}): void {
  if (active >= config.maxActive) {
    throw new SandboxCapacityError("The interactive demo is currently at capacity.");
  }
  if (recentForFingerprint >= config.maxCreatesPerHour) {
    throw new SandboxCreationRateLimitError("Too many demo sandboxes were created recently.");
  }
}
