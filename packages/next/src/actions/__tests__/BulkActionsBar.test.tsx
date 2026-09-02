// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { BulkActionsBar } from "../BulkActionsBar";

afterEach(cleanup);

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const bulkAction = {
  key: "archive all",
  label: "Archive",
  icon: "archive" as const,
  hasForm: false,
};

async function openMenuAndPick(label: string | RegExp) {
  fireEvent.keyDown(screen.getByRole("button", { name: /action…/i }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

describe("BulkActionsBar", () => {
  it("renders configured action icons in the menu", async () => {
    renderWithToast(
      <BulkActionsBar
        resource="users"
        selection={["1"]}
        onClear={vi.fn()}
        actions={[bulkAction]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /action…/i }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: /archive/i })).toBeTruthy();
    expect(document.querySelector('[data-flowpanel-icon="archive"]')).toBeTruthy();
  });

  it("encodes resource and action key in the fetch URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithToast(
      <BulkActionsBar
        resource="us ers"
        selection={["1", "2"]}
        onClear={vi.fn()}
        actions={[bulkAction]}
      />,
    );
    await openMenuAndPick(/archive/i);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/flowpanel/us%20ers/bulk-actions/archive%20all");
    vi.unstubAllGlobals();
  });

  it("falls back to statusText instead of throwing when the response body isn't JSON", async () => {
    const htmlResponse = new Response("<html>500</html>", {
      status: 500,
      statusText: "Internal Server Error",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse));

    renderWithToast(
      <BulkActionsBar
        resource="users"
        selection={["1"]}
        onClear={vi.fn()}
        actions={[bulkAction]}
      />,
    );
    await openMenuAndPick(/archive/i);

    expect(await screen.findByText("Internal Server Error")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
