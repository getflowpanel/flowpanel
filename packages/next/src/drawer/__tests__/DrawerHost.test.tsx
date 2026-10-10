// @vitest-environment happy-dom

import { ToastProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let search = "drawer=users:27";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams(search),
}));

import { DrawerHost } from "../DrawerHost";
import { RECORD_DEFAULTS } from "./payload-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  search = "drawer=users:27";
});

function openMenu(): void {
  fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
}

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
    ...RECORD_DEFAULTS,
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

function header(): HTMLElement {
  const title = screen
    .getAllByRole("heading", { level: 2 })
    .find((h) => !h.className.includes("fp-sr-only"));
  return title?.parentElement as HTMLElement;
}

describe("DrawerHost", () => {
  it("shows the resource's label in the subtitle, never the raw registry name or the id", async () => {
    stubFetch(["active"]);
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("Customers")).toBeTruthy());
    expect(header().textContent).not.toContain("27");
  });

  it("names the resource in the heading when the row fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
    const heading = header().querySelector("h2");
    expect(heading?.textContent).toBe("Users");
    expect(header().textContent).toBe("Users");
  });

  it("shows the subtitle the drawer computed from the row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ...payload("active"), subtitle: "Pro plan, since May" })),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("Pro plan, since May")).toBeTruthy());
    expect(screen.queryByText("Customers")).toBeNull();
  });

  it("holds a skeleton title while the row loads, not the id", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    expect(header().querySelector("h2 .fp-skeleton")).toBeTruthy();
    expect(header().textContent).not.toContain("27");
  });

  it("puts the drawer's actions in the record menu, a destructive one in the error colour", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...payload("active"),
              actions: [
                { key: "resend", label: "Resend" },
                { key: "ban", label: "Ban", variant: "destructive" },
              ],
            }),
          ),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => screen.getByRole("button", { name: "More actions" }));
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Resend" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Ban" }).className).toContain("fp-text-err");
  });

  it("shows a drawer action placed inline as a button beside Edit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...payload("active"),
              actions: [{ key: "approve", label: "Approve", placement: "inline" }],
            }),
          ),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("re-fetches the row after an action succeeds", async () => {
    const calls = stubFetch(["active", "disabled"]);
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getByText("active")).toBeTruthy());

    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Disable user" }));
    await vi.waitFor(() => expect(screen.getByText("disabled")).toBeTruthy());

    const gets = calls.filter((c) => c.init?.method !== "POST");
    expect(gets).toHaveLength(2);
    expect(gets[0]?.url).toBe("/api/flowpanel/drawer/users/27");
  });

  it("offers Edit and the row's own actions beside Delete, as the record page does", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...payload("active"),
              actions: [],
              rowActions: [{ key: "retry", label: "Retry run", hasForm: false }],
              editHref: "/admin/users/27/edit",
              delete: {
                label: "Delete",
                title: "Delete this user?",
                description: "This can't be undone.",
                successMessage: "User deleted",
                listHref: "/admin/users",
              },
            }),
          ),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    const edit = await vi.waitFor(() => screen.getByRole("link", { name: "Edit" }));
    expect(edit.getAttribute("href")).toBe("/admin/users/27/edit");
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Retry run" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("Delete this user?")).toBeTruthy();
  });

  it("never shows the previous record while the next one loads", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/27")) {
          return new Response(JSON.stringify({ ...payload("active"), title: "Ann" }));
        }
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }),
    );
    const { rerender } = render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    await vi.waitFor(() => expect(screen.getAllByText("Ann").length).toBeGreaterThan(0));

    search = "drawer=users:28";
    rerender(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    expect(screen.queryByText("Ann")).toBeNull();
    expect(screen.queryByText("active")).toBeNull();

    release(
      new Response(JSON.stringify({ ...payload("trialing"), row: { id: "28" }, title: "Bob" })),
    );
    await vi.waitFor(() => expect(screen.getAllByText("Bob").length).toBeGreaterThan(0));
    expect(screen.queryByText("Ann")).toBeNull();
  });

  it("says the record is gone when the server answers 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, error: "row not found" }), { status: 404 }),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    expect(await screen.findByText("This record doesn't exist or was deleted.")).toBeTruthy();
  });

  it("marks a deleted row and offers Restore instead of its actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...payload("active"),
              actions: [],
              deleted: true,
              deletedTitle: "This user was deleted",
              restorable: true,
            }),
          ),
      ),
    );
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    expect(await screen.findByText("This user was deleted")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
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
