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
    title: "a@b.c",
    resourceLabel: "Users",
    width: "lg",
    fields: [{ name: "email" }],
    tabs: null,
    actions: [],
    prerendered: {},
    labels: { email: "Email" },
    formats: {},
    references: {},
    detailHref,
    deleted: false,
    restorable: false,
    rowActions: [],
    editHref: null,
    delete: null,
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
      <LabelsProvider value={{ drawer: { viewDetails: "Открыть карточку" } }}>
        <DrawerHost />
      </LabelsProvider>,
    );

    const link = await waitFor(() => screen.getByRole("link", { name: "Открыть карточку" }));
    expect(link.getAttribute("href")).toBe("/admin/users/abc");
  });

  it("renders the link as a secondary button in the header, beside the title", async () => {
    mockFetch(mkPayload("/admin/users/abc"));

    render(<DrawerHost />);

    const link = await waitFor(() => screen.getByRole("link", { name: "Open full page" }));
    expect(link.dataset.variant).toBe("outline");
    expect(link.dataset.size).toBe("sm");
    const heading = screen
      .getAllByRole("heading", { name: "a@b.c" })
      .find((h) => !h.className.includes("fp-sr-only")) as HTMLElement;
    expect(link.closest("h2")).toBeNull();
    expect(heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.parentElement?.parentElement).toBe(heading.parentElement?.parentElement);
  });

  it("renders no link when the resource has no detail page", async () => {
    mockFetch(mkPayload(null));

    render(<DrawerHost />);

    await waitFor(() => expect(screen.getAllByText("a@b.c").length).toBeGreaterThan(0));
    expect(screen.queryByRole("link")).toBeNull();
  });
});
