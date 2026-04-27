import { describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "../../types/db";
import { publishResourceEvent } from "../publisher";

describe("publishResourceEvent", () => {
  it("writes a row to flowpanel_events with the channel name", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as unknown as SqlExecutor;

    await publishResourceEvent(db, "user", { op: "update", id: 42 });

    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO flowpanel_events");
    expect(params[0]).toBe("resource.user");
    expect(JSON.parse(params[1] as string)).toEqual({ op: "update", id: 42 });
  });

  it("swallows errors so the caller's mutation is unaffected", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("db offline"));
    const db = { execute } as unknown as SqlExecutor;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      publishResourceEvent(db, "user", { op: "delete", id: 1 }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('realtime publish for resource "user" failed'),
    );
    warn.mockRestore();
  });
});
