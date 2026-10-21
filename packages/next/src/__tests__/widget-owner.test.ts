import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { custom, metric, table } from "@flowpanel/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWidgetContext } from "../runtime/widget-context";
import {
  currentWidgetOwner,
  describeOwner,
  noteMemoHit,
  pageTimer,
  WidgetFailure,
  widgetOwner,
} from "../runtime/widget-owner";
import { warnOnce } from "../runtime/widget-reads";

const conveyor = widgetOwner(
  custom(() => null, {}, { label: "Конвейер" }),
  "/system",
  "section 2 widget 1",
);
const owner = (label: string, position: string) =>
  widgetOwner(
    metric(label, async () => 1),
    "/system",
    position,
  );

function clock(steps: number[]): () => number {
  let index = 0;
  return () => steps[index++] ?? 0;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("widget owners", () => {
  it("names a widget by its label, kind and place", () => {
    expect(describeOwner(conveyor)).toBe("«Конвейер» (custom, /system section 2 widget 1)");
    expect(describeOwner(widgetOwner(table({ resource: "user" }), "/", "section 1 widget 1"))).toBe(
      "table (/ section 1 widget 1)",
    );
    expect(owner("Bans", "section 1 widget 4").label).toBe("Bans");
  });

  it("prefixes a failure with the widget that threw it", async () => {
    const timer = pageTimer("/system", 1, { log: () => {} });
    const failure = await timer
      .run(conveyor, async () => {
        throw new Error("pipeline view missing");
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WidgetFailure);
    expect((failure as Error).message).toBe(
      "«Конвейер» (custom, /system section 2 widget 1): pipeline view missing",
    );
    expect((failure as Error).name).toBe("WidgetFailure");
    expect(failure).toMatchObject({
      kind: "custom",
      label: "Конвейер",
      where: "/system",
      position: "section 2 widget 1",
    });
  });

  it("keeps a refused connection in the message and a driver's parameters out of it", async () => {
    const timer = pageTimer("/system", 1, { log: () => {} });
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:54389"), {
      code: "ECONNREFUSED",
    });
    const failure = await timer
      .run(conveyor, async () => {
        throw new Error("Failed query: select count(*) from runs\nparams: ann@example.com", {
          cause: refused,
        });
      })
      .catch((error: unknown) => error);
    expect((failure as Error).message).toBe(
      "«Конвейер» (custom, /system section 2 widget 1): Failed query: select count(*) from runs\n" +
        "  caused by: Error [ECONNREFUSED]: connect ECONNREFUSED 127.0.0.1:54389",
    );
    expect((failure as Error).cause).toBeInstanceOf(Error);
    expect((failure as Error).name).toBe("WidgetConnectionFailure");
  });

  it("logs no driver error, and so no query parameters, in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const timer = pageTimer("/system", 1, { log: () => {} });
    const failure = await timer
      .run(conveyor, async () => {
        throw Object.assign(new Error("Failed query: select 1\nparams: ann@example.com"), {
          params: ["ann@example.com"],
        });
      })
      .catch((error: unknown) => error);
    expect((failure as Error).cause).toBeUndefined();
    expect((failure as Error).message).not.toContain("ann@example.com");
  });

  it("hands the widget boundary no AggregateError in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const timer = pageTimer("/system", 1, { log: () => {} });
    const refused = new AggregateError([new Error("connect ECONNREFUSED ::1:5432")], "");
    const failure = await timer
      .run(conveyor, async () => {
        throw new Error("Failed query", { cause: refused });
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WidgetFailure);
    expect(refused).not.toBeInstanceOf(AggregateError);
    expect(refused.errors).toHaveLength(1);
  });

  it("lets Next's redirect and not-found throws through unchanged", async () => {
    const timer = pageTimer("/system", 1, { log: () => {} });
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    await expect(
      timer.run(conveyor, async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});

describe("the slow-widget line", () => {
  it("lists widgets at or above 300 ms, slowest first, once every widget has settled", async () => {
    const lines: string[] = [];
    const timer = pageTimer("/system", 3, {
      now: clock([0, 0, 0, 299, 450, 300]),
      log: (line) => lines.push(line),
    });
    await Promise.all([
      timer.run(owner("Quick", "section 1 widget 1"), async () => 1),
      timer.run(owner("Slow", "section 1 widget 2"), async () => 2),
      timer.run(owner("Edge", "section 1 widget 3"), async () => 3),
    ]);
    expect(lines).toEqual([
      "[flowpanel] slow widgets on /system: «Slow» (metric, /system section 1 widget 2) 450 ms; " +
        "«Edge» (metric, /system section 1 widget 3) 300 ms",
    ]);
  });

  it("prints nothing when every widget is quick, and nothing in production", async () => {
    const lines: string[] = [];
    const quick = pageTimer("/", 1, { now: clock([0, 120]), log: (line) => lines.push(line) });
    await quick.run(owner("Quick", "section 1 widget 1"), async () => 1);
    vi.stubEnv("NODE_ENV", "production");
    const slow = pageTimer("/", 1, { now: clock([0, 900]), log: (line) => lines.push(line) });
    await slow.run(owner("Slow", "section 1 widget 1"), async () => 1);
    expect(lines).toEqual([]);
  });

  it("counts memo hits against the widget running now", async () => {
    const lines: string[] = [];
    const running = owner("Shared", "section 1 widget 1");
    const timer = pageTimer("/", 1, { now: clock([0, 400]), log: (line) => lines.push(line) });
    await timer.run(running, async () => {
      expect(currentWidgetOwner()).toBe(running);
      noteMemoHit();
      noteMemoHit();
    });
    expect(currentWidgetOwner()).toBeNull();
    expect(lines[0]).toMatch(
      /«Shared» \(metric, \/system section 1 widget 1\) 400 ms, 2 memo hits$/,
    );
  });

  it("names the running widget in a development warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const timer = pageTimer("/system", 1, { log: () => {} });
    await timer.run(owner("Visits", "section 1 widget 1"), async () => warnOnce("owner-test", "m"));
    expect(warn).toHaveBeenCalledWith(
      "[flowpanel] m In «Visits» (metric, /system section 1 widget 1).",
    );
    warn.mockRestore();
  });

  it("counts a query another widget already ran as the second widget's memo hit", async () => {
    const config = {
      paths: { admin: "/admin", api: "/api/flowpanel" },
      adapter: { kind: "drizzle", db: {} },
      labels: {},
      resourcesByName: new Map(),
      dashboardsByPath: new Map(),
      pagesByPath: new Map(),
      __resolved: true,
    } as unknown as ResolvedAdminConfig;
    const reqCtx: RequestContext = {
      req: new Request("http://localhost/admin"),
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
    };
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, {
      from: new Date("2026-09-14T00:00:00Z"),
      to: new Date("2026-09-21T00:00:00Z"),
      preset: "last7d",
    });
    const load = async () => 1;
    const lines: string[] = [];
    const timer = pageTimer("/system", 2, {
      now: clock([0, 0, 500, 500]),
      log: (l) => lines.push(l),
    });
    await Promise.all([
      timer.run(owner("First", "section 1 widget 1"), () => ctx.query(load)),
      timer.run(owner("Second", "section 1 widget 2"), () => ctx.query(load)),
    ]);
    expect(lines[0]).toContain("«First» (metric, /system section 1 widget 1) 500 ms;");
    expect(lines[0]).toContain("«Second» (metric, /system section 1 widget 2) 500 ms, 1 memo hit");
  });
});
