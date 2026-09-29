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

  it("names nothing the caller may not open", async () => {
    expect(await titleOf(["system"])).toBeUndefined();
  });

  it("names nothing for a visitor who is not signed in", async () => {
    const signedOut = admin(null);
    expect(await titleOf([], signedOut)).toBeUndefined();
    expect(await titleOf(["users"], signedOut)).toBeUndefined();
    expect(await titleOf(["nowhere"], signedOut)).toBeUndefined();
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
