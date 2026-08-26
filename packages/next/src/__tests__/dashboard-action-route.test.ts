import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  AuditConfig,
  DashboardAction,
  DashboardConfig,
  ResolvedAdminConfig,
  Session,
} from "@flowpanel/core";
import {
  dashboardActionRoute,
  decodeDashboardPath,
  encodeDashboardPath,
  serializeDashboardAction,
} from "../actions/dashboard-action";

function makeConfig(opts: {
  dashboard?: DashboardConfig;
  audit?: AuditConfig | undefined;
  role?: string;
  session?: Session | null;
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };

  const dashboardsByPath = new Map<string, DashboardConfig>();
  if (opts.dashboard) dashboardsByPath.set(opts.dashboard.path, opts.dashboard);

  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => opts.session ?? null, role: () => opts.role ?? "admin" },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [],
    resourcesByName: new Map(),
    dashboardsByPath,
    basePath: "/admin",
    __resolved: true,
  } as never;
  return config;
}

describe("dashboardActionRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the dashboard path is unknown", async () => {
    const config = makeConfig({});
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "ghost", action: "x" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("dashboard");
  });

  it("returns 404 when the action key is not in dashboard.actions", async () => {
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "trigger-scraper",
          label: "Trigger",
          run: async () => ({ ok: true }),
        },
      ],
    };
    const config = makeConfig({ dashboard });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "missing" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("action");
  });

  it("returns 403 when per-action requireRole fails", async () => {
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "trigger-scraper",
          label: "Trigger",
          requireRole: "admin",
          run: async () => ({ ok: true }),
        },
      ],
    };
    const config = makeConfig({ dashboard, role: "user" });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "trigger-scraper" }),
    });
    expect(res.status).toBe(403);
  });

  it("runs the action, applies refresh, and emits an audit event on success", async () => {
    const sink = vi.fn(async () => {});
    const run = vi.fn(async () => ({ ok: true as const, message: "queued" }));
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "trigger-scraper",
          label: "Trigger",
          form: [{ name: "reason", type: "text" }],
          run,
        } as DashboardAction,
      ],
    };
    const config = makeConfig({
      dashboard,
      audit: { enabled: true, sink },
    });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"reason":"manual"}',
    });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "trigger-scraper" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, message: "queued" });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "manual" }),
      expect.objectContaining({ session: null }),
    );
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dashboard.action.trigger-scraper",
        resource: "dashboard",
        targetId: "/pipeline",
      }),
    );
  });

  it("passes ctx.actorId derived from the session to run", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [{ key: "trigger-scraper", label: "Trigger", run } as DashboardAction],
    };
    const config = makeConfig({ dashboard, session: { id: "u1" } as unknown as Session });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "trigger-scraper" }),
    });
    expect(run).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: "u1" }));
  });

  it("returns 500 with a generic message (not the raw error) when action.run throws", async () => {
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "boom",
          label: "Boom",
          run: async () => {
            throw new Error("kaboom");
          },
        },
      ],
    };
    const config = makeConfig({ dashboard });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "boom" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).not.toContain("kaboom");
    expect(body.error).toBe("Internal server error");
  });

  it("returns 422 with issues when input fails the action's required form field", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "trigger",
          label: "Trigger",
          form: [{ name: "queue", type: "text", required: true }],
          run,
        } as DashboardAction,
      ],
    };
    const config = makeConfig({ dashboard });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "trigger" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation failed");
    expect(body.issues).toEqual([{ path: ["queue"], message: "queue is required" }]);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the action when the form validation succeeds", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const dashboard: DashboardConfig = {
      path: "/pipeline",
      label: "Pipeline",
      sections: [],
      actions: [
        {
          key: "trigger",
          label: "Trigger",
          form: [{ name: "queue", type: "text", required: true }],
          run,
        } as DashboardAction,
      ],
    };
    const config = makeConfig({ dashboard });
    const handler = dashboardActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queue: "scrape" }),
    });
    const res = await handler(req, {
      params: Promise.resolve({ dashboard: "pipeline", action: "trigger" }),
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ queue: "scrape" }),
      expect.anything(),
    );
  });
});

describe("encodeDashboardPath / decodeDashboardPath", () => {
  it("round-trips the root path through the _root_ sentinel", () => {
    expect(encodeDashboardPath("/")).toBe("_root_");
    expect(decodeDashboardPath("_root_")).toBe("/");
  });

  it("strips the leading slash on a flat path", () => {
    expect(encodeDashboardPath("/pipeline")).toBe("pipeline");
    expect(decodeDashboardPath("pipeline")).toBe("/pipeline");
  });

  it("maps interior slashes to __", () => {
    expect(encodeDashboardPath("/team/ops")).toBe("team__ops");
    expect(decodeDashboardPath("team__ops")).toBe("/team/ops");
  });
});

describe("serializeDashboardAction", () => {
  it("strips the runtime run callback from the wire shape", () => {
    const action: DashboardAction = {
      key: "trigger",
      label: "Trigger",
      icon: "play",
      variant: "default",
      requireRole: "admin",
      run: async () => ({ ok: true }),
    };
    const wire = serializeDashboardAction(action);
    expect(wire).toEqual({
      key: "trigger",
      label: "Trigger",
      icon: "play",
      variant: "default",
      hasForm: false,
    });
    expect("run" in wire).toBe(false);
    expect("requireRole" in wire).toBe(false);
  });

  it("normalizes the confirm string to the object form", () => {
    const wire = serializeDashboardAction({
      key: "k",
      label: "L",
      confirm: "Are you sure?",
      run: async () => ({ ok: true }),
    });
    expect(wire.confirm).toEqual({ title: "Are you sure?" });
  });

  it("emits no form on the wire when action.form is empty / missing", () => {
    const noForm = serializeDashboardAction({
      key: "k",
      label: "L",
      run: async () => ({ ok: true }),
    });
    expect(noForm.hasForm).toBe(false);
    expect("form" in noForm).toBe(false);

    const emptyForm = serializeDashboardAction({
      key: "k2",
      label: "L2",
      form: [],
      run: async () => ({ ok: true }),
    });
    expect(emptyForm.hasForm).toBe(false);
    expect("form" in emptyForm).toBe(false);
  });

  it("serializes the form schema for client rendering and strips callbacks", () => {
    const wire = serializeDashboardAction({
      key: "trigger-scrape",
      label: "Run scraper",
      form: [
        {
          name: "platforms",
          label: "Platforms",
          type: "multiselect",
          required: true,
          help: "Pick at least one",
          options: [
            { label: "Upwork", value: "upwork" },
            { label: "Toptal", value: "toptal" },
          ],
          // Non-serializable members below must be stripped from the wire shape.
          validate: () => null,
          defaultValue: ["upwork"],
        },
        {
          name: "force",
          label: "Force re-scrape",
          type: "boolean",
        },
      ],
      run: async () => ({ ok: true }),
    });
    expect(wire.hasForm).toBe(true);
    expect(wire.form).toEqual([
      {
        name: "platforms",
        label: "Platforms",
        type: "multiselect",
        required: true,
        help: "Pick at least one",
        options: [
          { label: "Upwork", value: "upwork" },
          { label: "Toptal", value: "toptal" },
        ],
      },
      { name: "force", label: "Force re-scrape", type: "boolean" },
    ]);
    // Callback-shaped members must not appear on the wire shape.
    expect(JSON.stringify(wire.form)).not.toContain("validate");
    expect(JSON.stringify(wire.form)).not.toContain("defaultValue");
  });

  it("does not serialize function-shaped options (left undefined for now)", () => {
    const wire = serializeDashboardAction({
      key: "k",
      label: "L",
      form: [
        {
          name: "queue",
          type: "select",
          // function-shaped options can't cross the wire — server should
          // emit no options[] and the client falls back to free text /
          // empty select.
          options: async () => [{ label: "X", value: "x" }],
        },
      ],
      run: async () => ({ ok: true }),
    });
    expect(wire.form?.[0]).toEqual({ name: "queue", type: "select" });
  });
});
