// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function payload(status: string) {
  return {
    row: { id: "27", status },
    header: "ann@example.com",
    resourceLabel: "Customers",
    width: "lg",
    fields: "*",
    tabs: null,
    actions: [{ key: "disable", label: "Disable user" }],
    prerendered: {},
    labels: {},
    formats: {},
  };
}

/** GET returns the next queued payload; POST returns a successful action result. */
function stubFetch(statuses: string[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let next = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ ok: true, message: "Disabled" }), { status: 200 });
    }
    const status = statuses[Math.min(next++, statuses.length - 1)] ?? "active";
    return new Response(JSON.stringify(payload(status)), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("DrawerHost", () => {
  it("shows the resource's label in the subtitle, not the raw registry name", async () => {
    stubFetch(["active"]);
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText(/Customers · 27/)).toBeTruthy());
    expect(screen.queryByText(/^users · 27$/)).toBeNull();
  });

  it("re-fetches the row after an action succeeds", async () => {
    const calls = stubFetch(["active", "disabled"]);
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("active")).toBeTruthy());

    fireEvent.click(screen.getByText("Disable user"));
    await vi.waitFor(() => expect(screen.getByText("disabled")).toBeTruthy());

    const gets = calls.filter((c) => c.init?.method !== "POST");
    expect(gets).toHaveLength(2);
    expect(gets[0]?.url).toBe("/api/flowpanel/drawer/users/27");
  });

  it("asks the browser not to serve the payload from cache", async () => {
    const calls = stubFetch(["active"]);
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]?.init?.cache).toBe("no-store");
  });
});
