// @vitest-environment happy-dom

import type { Adapter } from "@flowpanel/core";
import { defineAdmin } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ops/nope",
  useSearchParams: () => new URLSearchParams(),
}));

import { createFlowpanel } from "../create-flowpanel";

afterEach(cleanup);

const adapter = {
  kind: "test",
  introspect: () => ({ name: "x", columns: [] }),
} as never as Adapter;

describe("createFlowpanel(config).notFound", () => {
  it("renders the labelled page-not-found screen with its way back to the admin", () => {
    const { notFound: NotFoundPage } = createFlowpanel(
      defineAdmin({
        adapter,
        auth: { session: async () => null, role: () => "admin" },
        paths: { admin: "/ops", api: "/api/ops" },
        labels: { notFound: { title: "Nothing here" } },
      }),
    );
    const { container } = render(<NotFoundPage />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to admin" }).getAttribute("href")).toBe("/ops");
    expect(container.querySelector("[data-flowpanel-root]")).not.toBeNull();
    expect(document.title).toBe("Nothing here");
  });
});
