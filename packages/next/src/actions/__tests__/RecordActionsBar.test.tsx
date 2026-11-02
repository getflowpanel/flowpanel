// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { RecordActionsBar } from "../RecordActionsBar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a record page's Delete", () => {
  it("deletes through the resource route and leaves the gone record out of history", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, data: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <RecordActionsBar
          resource="users"
          id="u1"
          rowActions={[]}
          drawerActions={[]}
          editHref={null}
          delete={{
            label: "Delete",
            title: "Delete this user?",
            description: "This can't be undone.",
            successMessage: "User deleted",
            listHref: "/admin/users",
          }}
          afterDelete="list"
        />
      </ToastProvider>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/users"));
    expect(fetchMock).toHaveBeenCalledWith("/api/flowpanel/users/u1", { method: "DELETE" });
    expect(router.push).not.toHaveBeenCalled();
  });
});
