// @vitest-environment happy-dom

import type { Adapter, AdminDefinition } from "@flowpanel/core";
import { defineAdmin, FlowpanelAccessError, FlowpanelAuthError, resource } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { handleRenderError } from "../flowpanel-page";

afterEach(cleanup);

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "users",
    columns: [{ name: "id", type: "string", nullable: false, unique: true, primaryKey: true }],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => ({ id: "u1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function admin(extra: Partial<AdminDefinition>, signedIn: boolean) {
  return defineAdmin({
    adapter,
    auth: {
      session: async () => (signedIn ? { user: { role: "viewer" } } : null),
      role: () => "viewer",
    },
    resources: [resource({ __name: "users" }, { columns: ["id"] })],
    ...extra,
  });
}

async function refusal(error: Error, config: ReturnType<typeof admin>) {
  render(await handleRenderError(error, config, new Request("http://localhost/admin")));
}

describe("access and sign-in screens speak the admin's language", () => {
  it("says a Russian admin needs a sign-in in Russian", async () => {
    await refusal(
      new FlowpanelAuthError("no session"),
      admin({ formatting: { locale: "ru-RU" } }, false),
    );
    expect(screen.getByText("Требуется вход")).toBeTruthy();
    expect(screen.getByText("Войдите, чтобы открыть админку.")).toBeTruthy();
  });

  it("says a Russian admin's wrong role is refused in Russian", async () => {
    await refusal(
      new FlowpanelAccessError("forbidden"),
      admin({ formatting: { locale: "ru-RU" } }, true),
    );
    expect(screen.getByText("Нет доступа")).toBeTruthy();
    expect(screen.getByText("У вашей учётной записи нет прав на эту админку.")).toBeTruthy();
  });

  it("keeps the English screens for an admin without a locale", async () => {
    await refusal(new FlowpanelAccessError("forbidden"), admin({}, true));
    expect(screen.getByText("Access denied")).toBeTruthy();
    expect(
      screen.getByText("Your account doesn't have permission to view this admin."),
    ).toBeTruthy();
  });

  it("prints the host's own access labels", async () => {
    const labels = {
      access: {
        signInTitle: "Members only",
        signInDescription: "Log in with your staff account.",
        deniedTitle: "Staff only",
        deniedDescription: "Ask an owner for the admin role.",
      },
    };
    await refusal(new FlowpanelAuthError("no session"), admin({ labels }, false));
    expect(screen.getByText("Members only")).toBeTruthy();
    expect(screen.getByText("Log in with your staff account.")).toBeTruthy();
    cleanup();
    await refusal(new FlowpanelAccessError("forbidden"), admin({ labels }, true));
    expect(screen.getByText("Staff only")).toBeTruthy();
    expect(screen.getByText("Ask an owner for the admin role.")).toBeTruthy();
  });
});
