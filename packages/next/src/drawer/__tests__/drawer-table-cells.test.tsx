// @vitest-environment happy-dom

import type { RequestContext } from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { FormattingProvider, ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/review",
  useSearchParams: () => new URLSearchParams("drawer=review:27"),
}));

import { DataTableWithDrawerRows } from "../DataTableWithDrawerRows";
import { DrawerHost } from "../DrawerHost";
import { columnRenders, prerenderEach } from "../prerender";
import { rememberedCell, rememberRowCells } from "../table-cells";

const StatusBadge = Object.assign(
  () => {
    throw new Error(
      "Attempted to call StatusBadge() from the server but StatusBadge is on the client.",
    );
  },
  { $$typeof: Symbol.for("react.client.reference"), $$id: "badge#StatusBadge" },
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a render that returns a client component", () => {
  it("is skipped on the server without an error, where it cannot render", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const renders = columnRenders([
      { field: "model", render: () => createElement("span", null, createElement(StatusBadge)) },
      { field: "status", render: () => "open" },
    ]);
    expect(await prerenderEach(renders, {}, {} as RequestContext)).toEqual({ status: "open" });
    expect(error).not.toHaveBeenCalled();
  });

  it("shows in the drawer as the cell the list already rendered for that row", async () => {
    render(
      <DataTableWithDrawerRows
        resource="review"
        columns={[{ field: "title" }, { field: "model" }]}
        rows={[{ id: "27", title: "Landing page", model: "gpt" }]}
        prerenderedCells={[[undefined, createElement("b", null, "GPT-5 badge")]]}
        total={1}
        page={1}
        pageSize={20}
        rowKey="id"
        openDrawerOnRowClick
      />,
    );
    fireEvent.click(screen.getByText("Landing page"));
    expect(rememberedCell("review", "27", "model")).toBeTruthy();
    cleanup();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              header: "Landing page",
              width: "lg",
              fields: "*",
              actions: [],
              prerendered: {},
              labels: {},
              formats: {},
              tabs: [],
              row: { id: "27", model: "gpt" },
            }),
          ),
      ),
    );
    render(
      <FormattingProvider value={resolveFormatting({})}>
        <ToastProvider>
          <DrawerHost />
        </ToastProvider>
      </FormattingProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("GPT-5 badge")).toBeTruthy());
  });

  it("forgets the cells of another row", () => {
    rememberRowCells("review", "1", { model: "one" });
    expect(rememberedCell("review", "2", "model")).toBeUndefined();
  });
});
