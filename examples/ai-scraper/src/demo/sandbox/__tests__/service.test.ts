import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../../db/schema";
import { readSandboxConfig } from "../config";
import { SandboxCapacityError, SandboxCreationRateLimitError } from "../lifecycle";

const seedSandboxInTransaction = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../seed", () => ({ SEED_VERSION: 1, seedSandboxInTransaction }));

import { ensureSandbox, resetCurrentSandbox } from "../service";

const now = new Date("2026-08-30T00:00:00.000Z");
const config = readSandboxConfig({});

function databaseWithSelects(selectResults: unknown[][]) {
  const calls: string[] = [];
  let selectIndex = 0;
  const tx = {
    execute: vi.fn(async () => {
      calls.push("lock");
      return { rows: [{ acquired: true }] };
    }),
    insert: vi.fn((table: unknown) => {
      if (table === schema.demoMaintenance) {
        return {
          values: () => ({
            onConflictDoNothing: async () => {
              calls.push("maintenance-singleton");
            },
          }),
        };
      }
      return {
        values: async () => {
          calls.push("sandbox-insert");
        },
      };
    }),
    update: vi.fn((table: unknown) => {
      if (table === schema.demoMaintenance) {
        return {
          set: () => ({
            where: () => ({
              returning: async () => {
                calls.push("maintenance-claim");
                return [];
              },
            }),
          }),
        };
      }
      return { set: () => ({ where: async () => [] }) };
    }),
    delete: vi.fn(() => ({ where: async () => [] })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          calls.push("select");
          const rows = selectResults[selectIndex++] ?? [];
          return Object.assign(Promise.resolve(rows), { limit: async () => rows });
        },
      }),
    })),
  };
  return {
    calls,
    db: { transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx) },
  };
}

function existingSandbox(seedVersion = 1) {
  return {
    id: "private-id",
    seedVersion,
    createdAt: now,
    lastSeenAt: now,
    inactivityExpiresAt: new Date(now.getTime() + config.inactivityMs),
    absoluteExpiresAt: new Date(now.getTime() + config.absoluteMs),
    lastResetAt: null,
    fingerprintHash: null,
  };
}

beforeEach(() => {
  seedSandboxInTransaction.mockReset();
  seedSandboxInTransaction.mockResolvedValue(true);
});

describe("sandbox service hardening", () => {
  it("attempts due cleanup before returning an existing sandbox", async () => {
    const { db, calls } = databaseWithSelects([[existingSandbox()]]);
    const emit = vi.fn();

    await ensureSandbox({
      db: db as never,
      id: "private-id",
      fingerprintHash: null,
      now,
      config,
      emit,
    });

    expect(calls.slice(0, 4)).toEqual([
      "lock",
      "maintenance-singleton",
      "maintenance-claim",
      "select",
    ]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("records active count and capacity rejection without visitor identifiers", async () => {
    const { db } = databaseWithSelects([[], [], [{ count: 200 }], [{ count: 0 }]]);
    const events: unknown[] = [];

    await expect(
      ensureSandbox({
        db: db as never,
        id: "private-id",
        fingerprintHash: "private-fingerprint",
        now,
        config: { ...config, publicMode: true },
        emit: (event: unknown) => events.push(event),
      }),
    ).rejects.toBeInstanceOf(SandboxCapacityError);
    expect(events).toEqual([
      { event: "demo_sandbox_active_count", active: 200 },
      {
        event: "demo_sandbox_creation_rejected",
        reason: "capacity",
        active: 200,
        recentForFingerprint: 0,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("private-id");
    expect(JSON.stringify(events)).not.toContain("private-fingerprint");
  });

  it("records fingerprint creation rejection separately from capacity", async () => {
    const { db } = databaseWithSelects([[], [], [{ count: 1 }], [{ count: 10 }]]);
    const events: unknown[] = [];

    await expect(
      ensureSandbox({
        db: db as never,
        id: "private-id",
        fingerprintHash: "private-fingerprint",
        now,
        config: { ...config, publicMode: true },
        emit: (event: unknown) => events.push(event),
      }),
    ).rejects.toBeInstanceOf(SandboxCreationRateLimitError);
    expect(events.at(-1)).toEqual({
      event: "demo_sandbox_creation_rejected",
      reason: "fingerprint_rate_limit",
      active: 1,
      recentForFingerprint: 10,
    });
  });

  it("records a seed failure once and preserves the original exception", async () => {
    const failure = new TypeError("seed failed");
    seedSandboxInTransaction.mockRejectedValueOnce(failure);
    const { db } = databaseWithSelects([[existingSandbox(0)]]);
    const events: unknown[] = [];

    await expect(
      ensureSandbox({
        db: db as never,
        id: "private-id",
        fingerprintHash: null,
        now,
        config,
        emit: (event: unknown) => events.push(event),
      }),
    ).rejects.toBe(failure);
    expect(events).toEqual([{ event: "demo_sandbox_seed_failed", errorName: "TypeError" }]);
  });

  it("records a reset failure once and preserves the original exception", async () => {
    const failure = new Error("reset failed");
    seedSandboxInTransaction.mockRejectedValueOnce(failure);
    const { db } = databaseWithSelects([[{ lastResetAt: null }]]);
    const events: unknown[] = [];

    await expect(
      resetCurrentSandbox({
        db: db as never,
        id: "private-id",
        now,
        emit: (event: unknown) => events.push(event),
      }),
    ).rejects.toBe(failure);
    expect(events).toEqual([{ event: "demo_sandbox_reset_failed", errorName: "Error" }]);
  });

  it("does not report the expected reset cooldown as a service failure", async () => {
    const { db } = databaseWithSelects([[{ lastResetAt: now }]]);
    const emit = vi.fn();

    await expect(
      resetCurrentSandbox({ db: db as never, id: "private-id", now, emit }),
    ).rejects.toHaveProperty("name", "SandboxResetRateLimitError");
    expect(emit).not.toHaveBeenCalled();
  });
});
