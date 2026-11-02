// @vitest-environment happy-dom

import type {
  DashboardConfig,
  PageConfig,
  QueueConfig,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelAccessError } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn((url: string) => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
});
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => redirectSpy(url),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { handleRenderError, renderContent } from "../flowpanel-page";

afterEach(() => {
  cleanup();
  redirectSpy.mockClear();
});

const managers = { read: "manager", create: "manager", update: "manager", delete: "manager" };

function resourceOf(name: string, access: Record<string, string>, label: string): ResourceConfig {
  return {
    __kind: "resource",
    ref: { __name: name },
    options: { columns: [], access, label },
  } as unknown as ResourceConfig;
}

const users = resourceOf("user", managers, "Users");
const invoices = resourceOf("invoices", { ...managers, read: "support" }, "Invoices");
const reports: PageConfig = {
  path: "/reports",
  label: "Reports",
  access: "manager",
  component: () => null,
};
const revenue: DashboardConfig = {
  path: "/revenue",
  label: "Revenue",
  access: "manager",
  sections: [],
};
const emails: QueueConfig = {
  __kind: "queue",
  ref: {} as never,
  options: { label: "Emails", boardUrl: "http://localhost:3001", access: "manager" },
};

const config = {
  adapter: {} as never,
  auth: {
    session: async () => ({ user: { id: "sam", role: "support" } }),
    role: () => "support",
    signInUrl: "/login",
    forbiddenUrl: "/dashboard",
  },
  audit: { access: "manager" },
  auditLog: {} as never,
  resources: [users, invoices],
  resourcesByName: new Map([
    ["user", users],
    ["invoices", invoices],
  ]),
  dashboards: [revenue],
  dashboardsByPath: new Map([["/revenue", revenue]]),
  pagesByPath: new Map([["/reports", reports]]),
  queuesByKey: new Map([["emails", emails]]),
  paths: { admin: "/admin", api: "/api/flowpanel" },
  __resolved: true,
} as unknown as ResolvedAdminConfig;

const navGroups = [{ items: [{ label: "Invoices", href: "/admin/invoices" }] }];

describe("a role refused one route stays inside the admin", () => {
  it.each([
    ["the list of a resource it may not read", ["user"], "Users"],
    ["a record of a resource it may not read", ["user", "1"], "Users"],
    ["the create form of a resource it may not create", ["invoices", "new"], "Invoices"],
    ["the edit form of a resource it may not update", ["invoices", "1", "edit"], "Invoices"],
    ["a dashboard", ["revenue"], "Revenue"],
    ["a page", ["reports"], "Reports"],
    ["the audit log", ["audit-log"], "Audit log"],
    ["a queue", ["queues", "emails"], "Emails"],
  ])("%s shows the no-access screen, not a crash or forbiddenUrl", async (_, slug, label) => {
    const currentPath = `/admin/${slug.join("/")}`;
    const req = new Request(`http://localhost${currentPath}`);
    const refused = await renderContent(config, slug, new URLSearchParams(), req).then(
      () => null,
      (err: unknown) => err,
    );
    expect(refused).toBeInstanceOf(FlowpanelAccessError);

    render(await handleRenderError(refused, config, req, { slug, currentPath, navGroups }));
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: `You don't have access to ${label}` }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Invoices" }).getAttribute("href")).toBe(
      "/admin/invoices",
    );
  });

  it("still sends a role the whole admin refuses to forbiddenUrl", async () => {
    await expect(
      handleRenderError(new FlowpanelAccessError(), config, new Request("http://localhost/admin")),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});

describe("with the host's experimental.authInterrupts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("still answers a signed-out visitor with the admin's own sign-in screen", async () => {
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");
    const bare = {
      ...config,
      auth: { session: async () => null, role: () => "guest" },
    } as unknown as ResolvedAdminConfig;
    render(
      await handleRenderError(
        new FlowpanelAccessError(),
        bare,
        new Request("http://localhost/admin"),
      ),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sign in required" })).toBeTruthy();
  });
});
