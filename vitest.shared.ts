import { cpus } from "node:os";
import type { ViteUserConfig } from "vitest/config";

/**
 * Every package runs its own vitest, and turbo starts them together. Left to
 * their defaults each one sizes its pool to the whole machine, so the suites
 * oversubscribe the CPU by an order of magnitude and starve each other into
 * timeouts. Give each package a slice instead.
 */
const perPackage = Math.max(1, Math.floor(cpus().length / 4));

export const sharedTestConfig = {
  pool: "forks",
  poolOptions: {
    forks: { maxForks: perPackage, minForks: 1 },
    threads: { maxThreads: perPackage, minThreads: 1 },
  },
} satisfies ViteUserConfig["test"];
