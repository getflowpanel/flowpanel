// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { RowActionsMenu } from "../RowActionsMenu";

afterEach(cleanup);

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const inlineAction = {
  key: "sync",
  label: "Sync",
  icon: "refresh" as const,
  placement: "inline" as const,
  hasForm: false,
};

describe("RowActionsMenu", () => {
  it("renders a configured action icon", () => {
    renderWithToast(<RowActionsMenu resource="users" id="1" actions={[inlineAction]} />);
    expect(document.querySelector('[data-flowpanel-icon="refresh"]')).toBeTruthy();
  });

  it("encodes resource, id and action key in the fetch URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithToast(<RowActionsMenu resource="us ers" id="a/b?c#d" actions={[inlineAction]} />);
    fireEvent.click(screen.getByText("Sync"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/flowpanel/us%20ers/a%2Fb%3Fc%23d/actions/sync");
    vi.unstubAllGlobals();
  });

  it("falls back to statusText instead of throwing when the response body isn't JSON", async () => {
    const htmlResponse = new Response("<html>500</html>", {
      status: 500,
      statusText: "Internal Server Error",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse));

    renderWithToast(<RowActionsMenu resource="users" id="1" actions={[inlineAction]} />);
    fireEvent.click(screen.getByText("Sync"));

    expect(await screen.findByText("Internal Server Error")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
