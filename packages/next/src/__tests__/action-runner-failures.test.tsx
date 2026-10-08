// @vitest-environment happy-dom

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, FlowpanelValidationError, resource } from "@flowpanel/core";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ui.router }));
vi.mock("@flowpanel/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flowpanel/react")>()),
  useToast: () => ui.toast,
}));

import { rowActionRoute } from "../actions/row-action";
import { useActionRunner } from "../actions/use-action-runner";
import { withGuards } from "../runtime/with-guards";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (_ref, ctx) => ({ id: ctx.id }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [resource({ __name: "users" }, { columns: ["id"] })],
});

function answer(response: Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

async function run(): Promise<Record<string, string> | null> {
  const { result } = renderHook(() => useActionRunner());
  let out: Record<string, string> | null = null;
  await act(async () => {
    out = await result.current(
      "/api/flowpanel/users/u1/actions/gone",
      {},
      {
        failureMessage: "Action failed",
      },
    );
  });
  return out;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useActionRunner reads every failure body as text", () => {
  it("toasts the message of a 404 from a stale tab, never an object", async () => {
    answer(
      rowActionRoute(config)(new Request("http://localhost/x", { method: "POST", body: "{}" }), {
        params: Promise.resolve({ resource: "users", id: "u1", action: "gone" }),
      }),
    );
    expect(await run()).toBeNull();
    expect(ui.toast.error).toHaveBeenCalledWith("action not found");
  });

  it("returns a guard's validation errors as field errors for the form", async () => {
    answer(
      withGuards(config, new Request("http://localhost/x"), { write: false }, async () => {
        throw new FlowpanelValidationError({ reason: "Pick a reason" });
      }),
    );
    expect(await run()).toEqual({ reason: "Pick a reason" });
    expect(ui.toast.error).not.toHaveBeenCalled();
  });

  it("still reads an older { error: { message } } envelope", async () => {
    answer(
      Promise.resolve(
        Response.json(
          { ok: false, error: { code: "not_found", message: "action not found" } },
          { status: 404 },
        ),
      ),
    );
    await run();
    expect(ui.toast.error).toHaveBeenCalledWith("action not found");
  });
});
