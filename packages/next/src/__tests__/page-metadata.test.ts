import type { ResolvedAdminConfig } from "@flowpanel/core";
import { defineAdmin, queue, RU_LABELS, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

import { flowpanelMetadata, flowpanelNotFoundMetadata } from "../runtime/page-metadata";
import { adapter } from "./detail-fixture";

function admin(session: unknown = { id: "u1" }) {
  return defineAdmin({
    adapter,
    auth: { session: async () => session as never, role: () => "admin" },
    dashboards: [
      { path: "/", label: "Overview", sections: [] },
      { path: "/system", label: "System", sections: [], access: "owner" },
    ],
    resources: [
      resource({ __name: "users" }, { label: "Users", labelOne: "User", columns: ["id"] }),
    ],
  });
}

async function titleOf(slug: string[], config = admin()) {
  const metadata = await flowpanelMetadata(config)({ params: Promise.resolve({ slug }) });
  return metadata.title;
}

describe("the page title", () => {
  it("names a dashboard, a list and a record by their labels", async () => {
    expect(await titleOf([])).toBe("Overview");
    expect(await titleOf(["users"])).toBe("Users");
    expect(await titleOf(["users", "u1"])).toBe("User");
    expect(await titleOf(["users", "new"])).toBe("New user");
  });

  it("names a resource without labels by its singular name", async () => {
    const bare = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }) as never, role: () => "admin" },
      resources: [resource({ __name: "order_items" }, { columns: ["id"] })],
    });
    expect(await titleOf(["order_items"], bare)).toBe("Order items");
    expect(await titleOf(["order_items", "1"], bare)).toBe("Order item");
    expect(await titleOf(["order_items", "new"], bare)).toBe("New order item");
  });

  it("says not found for a page that does not exist", async () => {
    expect(await titleOf(["nowhere"])).toBe("Page not found");
  });

  it("names the root by the brand when no dashboard lives there", async () => {
    const withoutRoot = (brand?: { name: string }) =>
      defineAdmin({
        adapter,
        auth: { session: async () => ({ id: "u1" }) as never, role: () => "admin" },
        ...(brand ? { theme: { brand } } : {}),
        resources: [resource({ __name: "users" }, { label: "Users", columns: ["id"] })],
      });
    expect(await titleOf([], withoutRoot({ name: "Acme" }))).toBe("Acme");
    expect(await titleOf([], withoutRoot())).toBeUndefined();
  });

  it("names nothing the caller may not open", async () => {
    expect(await titleOf(["system"])).toBeUndefined();
  });

  it("names the wall a role-gated admin shows instead of the page", async () => {
    const gated = (session: unknown, role: string) =>
      defineAdmin({
        adapter,
        auth: { session: async () => session as never, role: () => role, access: "admin" },
        resources: [resource({ __name: "users" }, { label: "Users", columns: ["id"] })],
      });
    expect(await titleOf(["users"], gated(null, "guest"))).toBe("Sign in required");
    expect(await titleOf(["users"], gated({ id: "u1" }, "viewer"))).toBe("Access denied");
  });

  it("names only the sign-in wall for a visitor who is not signed in", async () => {
    const signedOut = admin(null);
    expect(await titleOf([], signedOut)).toBe("Sign in required");
    expect(await titleOf(["users"], signedOut)).toBe("Sign in required");
    expect(await titleOf(["nowhere"], signedOut)).toBe("Sign in required");
  });

  it("keeps every admin page out of search engines", async () => {
    const noIndex = { index: false, follow: false };
    const metadataOf = (slug: string[], config: ResolvedAdminConfig = admin()) =>
      flowpanelMetadata(config)({ params: Promise.resolve({ slug }) });
    expect((await metadataOf([])).robots).toEqual(noIndex);
    expect((await metadataOf(["users", "u1"])).robots).toEqual(noIndex);
    expect((await metadataOf(["nowhere"])).robots).toEqual(noIndex);
    expect((await metadataOf(["system"])).robots).toEqual(noIndex);
    expect((await metadataOf(["users"], admin(null))).robots).toEqual(noIndex);
    const failing = defineAdmin({
      adapter,
      auth: {
        session: async () => {
          throw new Error("auth down");
        },
        role: () => "admin",
      },
    });
    expect((await metadataOf([], failing)).robots).toEqual(noIndex);
  });

  it("does not name a create or edit page the caller may not use", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }) as never, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            label: "Users",
            labelOne: "User",
            columns: ["id"],
            access: { create: () => false, update: () => false },
          },
        ),
      ],
    });
    expect(await titleOf(["users", "new"], config)).toBeUndefined();
    expect(await titleOf(["users", "u1", "edit"], config)).toBeUndefined();
    expect(await titleOf(["users", "u1"], config)).toBe("User");
  });

  it("names a queue only for a role that may open it, and says not found for an unknown one", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }) as never, role: () => "admin" },
      queues: [
        queue({ name: "mail" }, { label: "Mail", boardUrl: "http://board/mail", key: "mail" }),
        queue(
          { name: "billing" },
          { label: "Billing", boardUrl: "http://board/b", key: "billing", access: "owner" },
        ),
      ],
      resources: [resource({ __name: "users" }, { label: "Users", columns: ["id"] })],
    });
    expect(await titleOf(["queues", "mail"], config)).toBe("Mail");
    expect(await titleOf(["queues", "billing"], config)).toBeUndefined();
    expect(await titleOf(["queues", "ghost"], config)).toBe("Page not found");
  });

  it("says not found for a record path the admin does not route", async () => {
    expect(await titleOf(["users", "u1", "edit"])).toBe("Edit user");
    expect(await titleOf(["users", "u1", "anything"])).toBe("Page not found");
    expect(await titleOf(["users", "u1", "edit", "more"])).toBe("Page not found");
  });
});

describe("the not-found page's metadata", () => {
  it("titles the 404 from the labels and keeps it out of search engines", () => {
    expect(flowpanelNotFoundMetadata(admin())).toEqual({
      title: "Page not found",
      robots: { index: false, follow: false },
    });
    const russian = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      formatting: { locale: "ru" },
      resources: [],
    });
    expect(flowpanelNotFoundMetadata(russian).title).toBe(RU_LABELS.notFound.title);
  });
});
