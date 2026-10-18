// @vitest-environment happy-dom

import type { Adapter, AdminDefinition } from "@flowpanel/core";
import {
  defineAdmin,
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelConfigError,
  FlowpanelRateLimitError,
  resource,
} from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { handleRenderError } from "../flowpanel-page";
import { sessionFailedWall } from "../runtime/walls";

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

async function refusal(
  error: Error,
  config: ReturnType<typeof admin>,
  place?: Parameters<typeof handleRenderError>[3],
) {
  render(await handleRenderError(error, config, new Request("http://localhost/admin"), place));
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
    expect(screen.getByRole("heading", { level: 1, name: "Нет доступа к админке" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Обновить страницу" })).toBeTruthy();
  });

  it("keeps the English screens for an admin without a locale", async () => {
    await refusal(new FlowpanelAccessError("forbidden"), admin({}, true));
    expect(
      screen.getByRole("heading", { level: 1, name: "You don't have access to this admin" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "You are signed in, but your role can't open this admin. Ask an admin for access.",
      ),
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

describe("a refused page leaves a way out", () => {
  const place = {
    slug: ["users"],
    currentPath: "/admin/users",
    navGroups: [
      {
        label: "Data",
        items: [
          { label: "Users", href: "/admin/users" },
          { label: "Orders", href: "/admin/orders" },
        ],
      },
    ],
  };

  it("names the section the role can't open and links to the next one it can", async () => {
    await refusal(new FlowpanelAccessError("forbidden"), admin({}, true), place);
    expect(
      screen.getByRole("heading", { level: 1, name: "You don't have access to Users" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Orders" }).getAttribute("href")).toBe(
      "/admin/orders",
    );
  });

  it("falls back to Reload when there is nowhere else to go", async () => {
    await refusal(new FlowpanelAccessError("forbidden"), admin({}, true), {
      slug: ["users"],
      currentPath: "/admin/users",
      navGroups: [{ label: "Data", items: [{ label: "Users", href: "/admin/users" }] }],
    });
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });

  it("offers another account when the admin has a sign-in page", async () => {
    await refusal(
      new FlowpanelAccessError("forbidden"),
      admin(
        {
          auth: { session: async () => ({ id: "u1" }), role: () => "viewer", signInUrl: "/login" },
        },
        true,
      ),
    );
    expect(
      screen.getByRole("link", { name: "Sign in with another account" }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  });

  it("reloads the sign-in wall once the reader has signed in", async () => {
    await refusal(new FlowpanelAuthError("no session"), admin({}, false));
    screen.getByRole("button", { name: "Reload page" }).click();
    expect(refresh).toHaveBeenCalled();
  });

  it("asks a rate-limited reader to wait and retry, in the admin's language", async () => {
    await refusal(new FlowpanelRateLimitError(), admin({}, true));
    expect(screen.getByRole("heading", { level: 1, name: "Too many requests" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    cleanup();
    await refusal(new FlowpanelRateLimitError(), admin({ formatting: { locale: "ru-RU" } }, true));
    expect(screen.getByRole("heading", { level: 1, name: "Слишком много запросов" })).toBeTruthy();
  });
});

describe("a session provider that throws", () => {
  it("shows a readable screen with the request id instead of Next's bare error page", () => {
    const config = admin({}, true);
    vi.stubEnv("NODE_ENV", "production");
    render(sessionFailedWall(config, "req-42", new Error("connect ECONNREFUSED 10.0.0.5:5432")));
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeTruthy();
    expect(screen.getByText("req-42", { exact: false })).toBeTruthy();
    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("says what FlowPanel itself refused, such as the development stub in production", () => {
    const config = admin({}, true);
    vi.stubEnv("NODE_ENV", "production");
    const refusal = new FlowpanelConfigError(
      "auth.session",
      "the stub refuses to run in production.",
    );
    render(sessionFailedWall(config, "req-43", refusal));
    expect(screen.getByText(refusal.message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    cleanup();
    render(sessionFailedWall(config, "req-44", new Error("[flowpanel] /srv/app/lib/auth.ts: no")));
    expect(screen.queryByText(/srv\/app/)).toBeNull();
    vi.unstubAllEnvs();
  });
});
