// @vitest-environment happy-dom

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { ErrorCard, HealthBanner, ToastProvider } from "@flowpanel/react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams("drawer=users:27"),
}));

import { DrawerHost } from "../drawer/DrawerHost";
import { QueryErrorCard } from "../runtime/query-error";
import { WidgetErrorBoundary } from "../runtime/WidgetErrorBoundary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COLUMNS = [
  { name: "id", type: "string" as const, nullable: false, unique: true, primaryKey: true },
];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: COLUMNS, primaryKey: "id" }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => ({ id: "u1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin", requireRole: "admin" },
  resources: [resource({ __name: "users" }, { columns: ["id"] })],
});

function Boom(): never {
  throw new Error("widget exploded");
}

/**
 * `@flowpanel/test`'s walk finds a page that rendered while the read under it
 * failed by looking for `[data-fp-error]`. Every surface that says "this failed"
 * has to carry it, or the smoke test reports a healthy admin.
 */
describe("every FlowPanel error surface is findable by data-fp-error", () => {
  it("tags the card a failed adapter read renders", () => {
    const card = QueryErrorCard({
      site: { config, resource: "users", operation: "get", requestId: "r1" },
      cause: new Error("boom"),
    });
    expect((card.props as { "data-fp-error"?: string })["data-fp-error"]).toBe("");
  });

  it("tags the card a failed widget leaves behind", () => {
    const { container } = render(<ErrorCard error={new Error("boom")} />);
    expect(container.querySelector("[data-fp-error]")).toBeTruthy();
  });

  it("tags what a widget error boundary renders in place of the widget", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <WidgetErrorBoundary widgetId="w1">
        <Boom />
      </WidgetErrorBoundary>,
    );
    expect(container.querySelector("[data-fp-error]")).toBeTruthy();
  });

  it("tags the health banner's error tone and leaves its other tones alone", () => {
    const { container: error } = render(<HealthBanner tone="error" title="Adapter unreachable" />);
    expect(error.querySelector("[data-fp-error]")).toBeTruthy();

    cleanup();
    const { container: warn } = render(<HealthBanner tone="warn" title="Slow" />);
    expect(warn.querySelector("[data-fp-error]")).toBeNull();
  });

  it("tags a drawer whose payload read failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500, statusText: "Server Error" })),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );

    // The drawer renders through a portal, so it is in the document, not in `container`.
    await waitFor(() => expect(document.querySelector("[data-fp-error]")).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
