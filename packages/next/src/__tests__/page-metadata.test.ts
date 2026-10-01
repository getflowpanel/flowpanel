import type { ResolvedAdminConfig } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));

import { flowpanelMetadata } from "../runtime/page-metadata";
import { adapter } from "./detail-fixture";

function admin(session: unknown = { id: "u1" }) {
  return defineAdmin({
    adapter,
    auth: { session: async () => session as never, role: () => "admin" },
    dashboards: [
      { path: "/", label: "Overview", sections: [] },
      { path: "/system", label: "System", sections: [], requireRole: "owner" },
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
    expect(await titleOf(["users", "new"])).toBe("New User");
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

  it("names nothing for a visitor who is not signed in", async () => {
    const signedOut = admin(null);
    expect(await titleOf([], signedOut)).toBeUndefined();
    expect(await titleOf(["users"], signedOut)).toBeUndefined();
    expect(await titleOf(["nowhere"], signedOut)).toBeUndefined();
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

  it("does not name a create page the caller may not use", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }) as never, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          { label: "Users", labelOne: "User", columns: ["id"], access: { create: () => false } },
        ),
      ],
    });
    expect(await titleOf(["users", "new"], config)).toBeUndefined();
  });
});
