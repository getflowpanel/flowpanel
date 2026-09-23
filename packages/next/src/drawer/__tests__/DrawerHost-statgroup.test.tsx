// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams("drawer=users:27"),
}));

import { DrawerHost } from "../DrawerHost";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const payload = {
  row: { id: "27" },
  header: "ann@example.com",
  resourceLabel: "Customers",
  width: "lg",
  fields: "*",
  tabs: [
    {
      kind: "widgets",
      key: "health",
      label: "Health",
      widgets: [
        {
          kind: "statGroup",
          label: "Delivery",
          stats: [
            { label: "Errors", value: 2, tone: "err", href: "/admin/runs" },
            { label: "Revenue", value: 1200, format: "currency" },
          ],
        },
      ],
    },
  ],
  actions: [],
  prerendered: {},
  labels: {},
  formats: {},
};

describe("a statGroup in the drawer", () => {
  it("renders like the dashboard card: tone, link and number format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("Errors")).toBeTruthy());
    const errors = screen.getByRole("link", { name: "2" });
    expect(errors.getAttribute("href")).toBe("/admin/runs");
    expect(errors.parentElement?.className).toContain("text-fp-err-text");
    expect(screen.getByText("$1,200")).toBeTruthy();
  });
});
