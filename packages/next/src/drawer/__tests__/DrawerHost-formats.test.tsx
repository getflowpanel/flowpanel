// @vitest-environment happy-dom

import { resolveFormatting } from "@flowpanel/core";
import { FormattingProvider, ToastProvider } from "@flowpanel/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams("drawer=users:27"),
}));

import { DrawerHost } from "../DrawerHost";
import { RECORD_DEFAULTS } from "./payload-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const base = {
  header: "ann@example.com",
  resourceLabel: "Customers",
  width: "lg",
  fields: "*",
  actions: [],
  prerendered: {},
  labels: {},
};

function openDrawer(payload: Record<string, unknown>) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ...base, ...payload }), { status: 200 })),
  );
  render(
    <FormattingProvider value={resolveFormatting({ locale: "ru-RU", timeZone: "Europe/Moscow" })}>
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>
    </FormattingProvider>,
  );
}

describe("drawer cells", () => {
  it("print a field's format in the admin's locale and zone", async () => {
    openDrawer({
      row: { id: "27", seenAt: "2026-09-23T11:55:00Z", paidAt: "2026-09-23T21:30:00Z" },
      tabs: [],
      ...RECORD_DEFAULTS,
      formats: { seenAt: "relative", paidAt: "date" },
    });
    await vi.waitFor(() => expect(screen.getByText("5 минут назад")).toBeTruthy());
    expect(screen.getByText("24.09.2026")).toBeTruthy();
  });

  it("print a widget table's column format", async () => {
    openDrawer({
      row: { id: "27" },
      ...RECORD_DEFAULTS,
      formats: {},
      tabs: [
        {
          kind: "widgets",
          key: "latency",
          label: "Latency",
          widgets: [
            {
              kind: "table",
              rows: [{ stage: "score", p95: 7_500_000 }],
              columns: [{ field: "stage" }, { field: "p95", format: "duration" }],
            },
          ],
        },
      ],
    });
    await vi.waitFor(() => expect(screen.getByText("2 ч 5 мин")).toBeTruthy());
  });
});
