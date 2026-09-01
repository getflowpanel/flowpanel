import type { RequestContext } from "@flowpanel/kit";
import { describe, expect, it } from "vitest";
import { runs } from "../config/resources/runs";

const requestContext: RequestContext = {
  req: new Request("http://localhost/admin/runs"),
  session: null,
  role: "admin",
  scope: { sandboxId: "local" },
  ip: null,
  userAgent: null,
};

describe("runs resource", () => {
  it("uses a unit-agnostic heading for formatted durations", () => {
    const duration = (runs.options.columns ?? []).find(
      (column) => typeof column === "object" && column.field === "durationMs",
    );

    expect(duration).toMatchObject({ label: "Duration" });
    if (!duration || typeof duration === "string" || !duration.render) {
      throw new Error("Duration column must define a renderer");
    }
    expect(
      duration.render(
        {
          id: 1,
          sandboxId: "local",
          seedKey: null,
          monitorId: 1,
          status: "success",
          pagesCrawled: 10,
          itemsExtracted: 5,
          durationMs: 1500,
          startedAt: new Date("2026-08-31T00:00:00.000Z"),
          finishedAt: new Date("2026-08-31T00:00:01.500Z"),
          error: null,
        },
        requestContext,
      ),
    ).toBe("1.5 s");
  });
});
