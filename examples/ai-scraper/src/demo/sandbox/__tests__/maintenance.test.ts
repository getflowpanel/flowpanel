import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredSandboxes, databaseMaintenanceRepository } from "../maintenance";

const now = new Date("2026-08-30T00:00:00.000Z");

describe("sandbox cleanup coordination", () => {
  it("does no deletion when another instance owns the maintenance claim", async () => {
    const repository = {
      claim: vi.fn(async () => false),
      deleteExpired: vi.fn(async () => 0),
      approximateRows: vi.fn(async () => 0),
    };
    const emit = vi.fn();

    await expect(
      cleanupExpiredSandboxes({ repository, now, cleanupIntervalMs: 15 * 60_000, emit }),
    ).resolves.toEqual({ claimed: false, deleted: 0 });
    expect(repository.deleteExpired).not.toHaveBeenCalled();
    expect(repository.approximateRows).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("deletes both inactivity- and absolute-expired rows after a successful claim", async () => {
    const repository = {
      claim: vi.fn(async () => true),
      deleteExpired: vi.fn(async () => 7),
      approximateRows: vi.fn(async () => 321),
    };
    const events: unknown[] = [];

    await expect(
      cleanupExpiredSandboxes({
        repository,
        now,
        cleanupIntervalMs: 15 * 60_000,
        emit: (event: unknown) => events.push(event),
      }),
    ).resolves.toEqual({ claimed: true, deleted: 7, approximateRows: 321 });
    expect(repository.deleteExpired).toHaveBeenCalledWith(now);
    expect(events).toEqual([{ event: "demo_sandbox_cleanup", deleted: 7, approximateRows: 321 }]);
  });

  it("allows an operator to force cleanup without waiting for a claim", async () => {
    const repository = {
      claim: vi.fn(async () => true),
      deleteExpired: vi.fn(async () => 3),
      approximateRows: vi.fn(async () => 89),
    };

    await expect(
      cleanupExpiredSandboxes({ repository, now, cleanupIntervalMs: 15 * 60_000, force: true }),
    ).resolves.toEqual({ claimed: true, deleted: 3, approximateRows: 89 });
    expect(repository.claim).toHaveBeenCalledWith(now, 15 * 60_000, true);
  });

  it("acquires the global advisory lock before advancing the maintenance claim", async () => {
    const calls: string[] = [];
    const database = {
      execute: vi.fn(async () => {
        calls.push("lock");
        return { rows: [{ acquired: true }] };
      }),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoNothing: async () => {
            calls.push("insert-singleton");
          },
        }),
      })),
      update: vi.fn(() => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              calls.push("advance-claim");
              return [{ id: 1 }];
            },
          }),
        }),
      })),
    };

    const repository = databaseMaintenanceRepository(database as never);

    await expect(repository.claim(now, 15 * 60_000)).resolves.toBe(true);
    expect(calls).toEqual(["lock", "insert-singleton", "advance-claim"]);
  });

  it("leaves the singleton untouched when another instance holds the global lock", async () => {
    const database = {
      execute: vi.fn(async () => ({ rows: [{ acquired: false }] })),
      insert: vi.fn(),
      update: vi.fn(),
    };

    const repository = databaseMaintenanceRepository(database as never);

    await expect(repository.claim(now, 15 * 60_000)).resolves.toBe(false);
    expect(database.insert).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
  });
});
