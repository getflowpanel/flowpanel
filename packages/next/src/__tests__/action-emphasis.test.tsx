// @vitest-environment happy-dom

import { RecordActionsBar } from "@flowpanel/next/client";
import { PageHeader } from "@flowpanel/react";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardActionsBar } from "../actions/DashboardActionsBar";
import {
  type SerializedDashboardAction,
  serializeDashboardAction,
  warnManyPrimary,
} from "../actions/dashboard-action";
import { findAll, renderDetail } from "./detail-fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

afterEach(cleanup);

const run = async () => ({ ok: true as const });

describe("dashboard action emphasis", () => {
  it("carries emphasis over the wire", () => {
    expect(
      serializeDashboardAction({ key: "a", label: "A", emphasis: "primary", run }).emphasis,
    ).toBe("primary");
    expect(serializeDashboardAction({ key: "b", label: "B", run }).emphasis).toBeUndefined();
  });

  it("draws an action as a secondary button unless it is the primary one", () => {
    const actions: SerializedDashboardAction[] = [
      { key: "sync", label: "Sync", hasForm: false },
      { key: "fix", label: "Fix", hasForm: false, emphasis: "primary" },
      { key: "drop", label: "Drop", hasForm: false, variant: "destructive" },
    ];
    render(<DashboardActionsBar encodedPath="_root_" actions={actions} />);
    const sync = screen.getByRole("button", { name: "Sync" });
    const fix = screen.getByRole("button", { name: "Fix" });
    const drop = screen.getByRole("button", { name: "Drop" });
    expect(sync.dataset.variant).toBe("outline");
    expect(fix.dataset.variant).toBe("default");
    expect(drop.dataset.variant).toBe("outline");
    expect(drop.className).toContain("fp-text-err-ink");
  });

  it("wraps its buttons on a narrow screen instead of pushing one off it", () => {
    const actions: SerializedDashboardAction[] = [
      { key: "a", label: "Run the scraper", hasForm: false },
      { key: "b", label: "Score orders", hasForm: false },
      { key: "c", label: "Retry failed", hasForm: false, emphasis: "primary" },
    ];
    render(<DashboardActionsBar encodedPath="_root_" actions={actions} />);
    const row = screen.getByRole("button", { name: "Retry failed" }).parentElement as HTMLElement;
    expect(row.className).toContain("fp-flex-wrap");
    expect(row.className).toContain("fp-max-w-full");
  });

  it("warns once in development when a bar holds more than one primary action", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = { hasForm: false, emphasis: "primary" as const };
    warnManyPrimary([{ key: "a", label: "A", ...primary }], 'dashboard "/"');
    expect(warn).not.toHaveBeenCalled();
    const two = [
      { key: "a", label: "A", ...primary },
      { key: "b", label: "B", ...primary },
    ];
    warnManyPrimary(two, 'dashboard "/ops"');
    warnManyPrimary(two, 'dashboard "/ops"');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("A, B");
    warn.mockRestore();
  });
});

function recordMenu(tree: ReactNode) {
  const actions = findAll(tree, PageHeader)[0]?.actions as ReactNode;
  return findAll(actions, RecordActionsBar)[0];
}

function editLink(emphasis?: "primary" | "secondary") {
  render(
    <RecordActionsBar
      resource="users"
      id="u1"
      rowActions={[]}
      drawerActions={[]}
      editHref="/admin/users/u1/edit"
      delete={null}
      afterDelete="list"
      {...(emphasis ? { editEmphasis: emphasis } : {})}
    />,
  );
  return screen.getByRole("link", { name: "Edit" });
}

describe("the record page's edit button", () => {
  it("is secondary by default", async () => {
    const { tree } = await renderDetail({ label: "User", columns: ["id"] });
    expect(recordMenu(tree)?.editEmphasis).toBeUndefined();
    expect(editLink().dataset.variant).toBe("outline");
  });

  it("is primary when update says so", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      update: { emphasis: "primary" },
    });
    expect(recordMenu(tree)?.editEmphasis).toBe("primary");
    expect(editLink("primary").dataset.variant).toBe("default");
  });
});
