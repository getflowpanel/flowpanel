// @vitest-environment happy-dom

import type { AuditLogEntry, AuditLogStore } from "@flowpanel/core";
import { DEFAULT_LABELS, defineAdmin, resource } from "@flowpanel/core";
import { AuditFullValue } from "@flowpanel/next/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditFeed, auditFeedItems } from "../pages/audit/audit-feed";
import { adapter } from "./detail-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const long = "x".repeat(300_000);
const prose = `${"Lorem ipsum dolor sit amet. ".repeat(40_000)}`;

const event: AuditLogEntry = {
  id: "e1",
  actorId: "u9",
  actorName: "Ann Lee",
  action: "users.update",
  resource: "users",
  targetId: "u1",
  diff: { before: { email: prose, plan: "free" }, after: { email: long, plan: "pro" } },
  at: new Date("2026-10-09T10:00:00Z"),
};

function admin() {
  const log: AuditLogStore = {
    append: async () => {},
    list: async () => ({ entries: [event], total: 1, capped: false }),
    entry: async () => event,
    facets: async () => ({ actors: [], actions: [] }),
  };
  return defineAdmin({
    adapter: { ...adapter, auditLog: log },
    auth: { session: async () => ({ id: "me" }), role: () => "admin" },
    audit: { enabled: true },
    resources: [resource({ __name: "users" }, { columns: ["id", "email", "plan"] })],
  });
}

describe("a long audit value in the feed", () => {
  it("prints a bounded start with Show full value, so a 1 MB edit stays a small page", async () => {
    const items = await auditFeedItems(
      admin(),
      {
        requestId: "r1",
        req: new Request("http://localhost/admin/audit-log"),
        session: { id: "me" },
        role: "admin",
        scope: null,
        ip: null,
        userAgent: null,
      },
      [event],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    const html = render(<AuditFeed items={items} labels={DEFAULT_LABELS.audit} />).container
      .innerHTML;
    expect(html.length).toBeLessThan(5_000);
    expect(html).toContain("Show full value");
    expect(html).toContain("fp-wrap-anywhere");
    expect(html).toContain("free");
  });
});

describe("AuditFullValue", () => {
  const props = { eventId: "e 1", field: "note", side: "after", text: "xxxx" } as const;

  it("fetches the whole value on demand and folds it back", async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true, value: "x".repeat(10) }));
    vi.stubGlobal("fetch", fetch);
    render(<AuditFullValue {...props} />);
    expect(screen.getByText("xxxx…")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Show full value" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => fireEvent.click(button));
    expect(fetch).toHaveBeenCalledWith("/api/flowpanel/audit/e%201/value?field=note&side=after");
    const whole = screen.getByRole("textbox", { name: "Show full value" });
    expect((whole as HTMLTextAreaElement).value).toBe("x".repeat(10));
    expect(whole.hasAttribute("readonly")).toBe(true);
    const less = screen.getByRole("button", { name: "Show less" });
    expect(less.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(less);
    expect(screen.getByText("xxxx…")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show full value" })));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks once however fast the button is pressed, and names the whole value", async () => {
    let answer: (response: Response) => void = () => {};
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<AuditFullValue {...props} name="Note, after" />);
    expect(screen.getByRole("status").textContent).toBe("");
    const button = screen.getByRole("button", { name: "Show full value" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => answer(Response.json({ ok: true, value: "long" })));
    expect(screen.getByRole("textbox", { name: "Note, after" })).toBeTruthy();
  });

  it("keeps the start and says so when the value cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: false, error: "not found" }, { status: 404 })),
    );
    render(<AuditFullValue {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show full value" })));
    expect(screen.getByRole("status").textContent).toBe(DEFAULT_LABELS.audit.fullValueFailed);
    expect(screen.getByText("xxxx…")).toBeTruthy();
  });
});
