// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("drawer=users:abc"),
  usePathname: () => "/admin/users",
}));

import { LabelsProvider } from "@flowpanel/react";
import { DrawerHost } from "../DrawerHost";
import type { DrawerPayload } from "../drawer-route";

function mkPayload(detailHref: string | null): DrawerPayload {
  return {
    row: { id: "abc", email: "a@b.c" },
    header: "a@b.c",
    resourceLabel: "Users",
    width: "lg",
    fields: [{ name: "email" }],
    tabs: null,
    actions: [],
    prerendered: {},
    labels: { email: "Email" },
    formats: {},
    detailHref,
  };
}

function mockFetch(payload: DrawerPayload): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DrawerHost detail link", () => {
  it("offers the record's own page with the `drawer.viewDetails` label", async () => {
    mockFetch(mkPayload("/admin/users/abc"));

    render(
      <LabelsProvider value={{ drawer: { viewDetails: "Открыть страницу →" } }}>
        <DrawerHost />
      </LabelsProvider>,
    );

    const link = await waitFor(() => screen.getByRole("link", { name: "Открыть страницу →" }));
    expect(link.getAttribute("href")).toBe("/admin/users/abc");
  });

  it("renders no link when the resource has no detail page", async () => {
    mockFetch(mkPayload(null));

    render(<DrawerHost />);

    await waitFor(() => expect(screen.getAllByText("a@b.c").length).toBeGreaterThan(0));
    expect(screen.queryByRole("link")).toBeNull();
  });
});
