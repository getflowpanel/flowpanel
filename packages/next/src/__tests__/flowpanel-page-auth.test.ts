import type {
  DashboardConfig,
  PageConfig,
  QueueConfig,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelAccessError, FlowpanelAuthError } from "@flowpanel/core";
import { EmptyState } from "@flowpanel/react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn((url: string) => {
  // Mirrors Next's real `redirect()`: throws a control-flow error that must
  // propagate out of the caller, not get swallowed.
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
  throw err;
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectSpy(url),
}));

import { handleRenderError, renderContent } from "../flowpanel-page.js";
import { DashboardPage } from "../pages/dashboard.js";
import { NotFound } from "../pages/not-found.js";
import { QueuePage } from "../pages/queue-page.js";
import { UserPage } from "../pages/user-page.js";
import { Welcome } from "../pages/welcome.js";

function makeConfig(overrides: Partial<ResolvedAdminConfig> = {}): ResolvedAdminConfig {
  return {
    adapter: {} as never,
    auth: {
      session: async () => ({ user: { id: "u1", role: "admin" } }),
      role: (s) => (s as { user?: { role?: string } } | null)?.user?.role ?? "guest",
    },
    resources: [],
    resourcesByName: new Map(),
    dashboardsByPath: new Map(),
    pagesByPath: new Map(),
    queuesByKey: new Map(),
    basePath: "/admin",
    __resolved: true,
    ...overrides,
  } as ResolvedAdminConfig;
}

describe("renderContent — admin-wide requireRole", () => {
  it("rejects a dashboard render when admin-wide requireRole fails, even without its own gate", async () => {
    const dash: DashboardConfig = { path: "/", label: "Home", sections: [] };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        requireRole: "admin",
      },
      dashboards: [dash],
      dashboardsByPath: new Map([["/", dash]]),
    } as never);

    await expect(
      renderContent(config, [], new URLSearchParams(), new Request("http://localhost/admin")),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("renders the dashboard when admin-wide requireRole passes and the dashboard has no own gate", async () => {
    const dash: DashboardConfig = { path: "/", label: "Home", sections: [] };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        requireRole: "admin",
      },
      dashboards: [dash],
      dashboardsByPath: new Map([["/", dash]]),
    } as never);

    const node = await renderContent(
      config,
      [],
      new URLSearchParams(),
      new Request("http://localhost/admin"),
    );
    expect(isValidElement(node) && node.type).toBe(DashboardPage);
  });

  it("rejects a user page render when admin-wide requireRole fails, even without its own gate", async () => {
    const page: PageConfig = { path: "/reports", label: "Reports", component: () => null };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        requireRole: "admin",
      },
      pagesByPath: new Map([["/reports", page]]),
    } as never);

    await expect(
      renderContent(
        config,
        ["reports"],
        new URLSearchParams(),
        new Request("http://localhost/admin/reports"),
      ),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("renders the user page when admin-wide requireRole passes and the page has no own gate", async () => {
    const page: PageConfig = { path: "/reports", label: "Reports", component: () => null };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        requireRole: "admin",
      },
      pagesByPath: new Map([["/reports", page]]),
    } as never);

    const node = await renderContent(
      config,
      ["reports"],
      new URLSearchParams(),
      new Request("http://localhost/admin/reports"),
    );
    expect(isValidElement(node) && node.type).toBe(UserPage);
  });

  it("rejects a queue render when admin-wide requireRole fails, even without its own gate", async () => {
    const queue: QueueConfig = {
      __kind: "queue",
      ref: {} as never,
      options: { label: "Scraper", boardUrl: "http://localhost:3001" },
    };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        requireRole: "admin",
      },
      queuesByKey: new Map([["scraper", queue]]),
    } as never);

    await expect(
      renderContent(
        config,
        ["queues", "scraper"],
        new URLSearchParams(),
        new Request("http://localhost/admin/queues/scraper"),
      ),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("renders the queue when admin-wide requireRole passes and the queue has no own gate", async () => {
    const queue: QueueConfig = {
      __kind: "queue",
      ref: {} as never,
      options: { label: "Scraper", boardUrl: "http://localhost:3001" },
    };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        requireRole: "admin",
      },
      queuesByKey: new Map([["scraper", queue]]),
    } as never);

    const node = await renderContent(
      config,
      ["queues", "scraper"],
      new URLSearchParams(),
      new Request("http://localhost/admin/queues/scraper"),
    );
    expect(isValidElement(node) && node.type).toBe(QueuePage);
  });
});

describe("handleRenderError", () => {
  beforeEach(() => {
    redirectSpy.mockClear();
  });

  it("re-throws errors that aren't FlowpanelAuthError/FlowpanelAccessError", async () => {
    const config = makeConfig();
    const boom = new Error("db exploded");
    await expect(handleRenderError(boom, config)).rejects.toBe(boom);
  });

  it("redirects to signInUrl when unauthenticated (session() returns null)", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest", signInUrl: "/sign-in" },
    } as never);
    await expect(handleRenderError(new FlowpanelAccessError(), config)).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in",
    );
    expect(redirectSpy).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to forbiddenUrl when authenticated but the role is wrong", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        forbiddenUrl: "/403",
      },
    } as never);
    await expect(handleRenderError(new FlowpanelAccessError(), config)).rejects.toThrow(
      "NEXT_REDIRECT:/403",
    );
    expect(redirectSpy).toHaveBeenCalledWith("/403");
  });

  it("always prefers signInUrl for FlowpanelAuthError, even with a session", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        signInUrl: "/sign-in",
        forbiddenUrl: "/403",
      },
    } as never);
    await expect(handleRenderError(new FlowpanelAuthError(), config)).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in",
    );
    expect(redirectSpy).toHaveBeenCalledWith("/sign-in");
  });

  it("renders a branded sign-in screen when unauthenticated and signInUrl isn't configured", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest" },
    } as never);
    const node = await handleRenderError(new FlowpanelAccessError(), config);
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(isValidElement(node) && node.type).toBe(EmptyState);
    expect(isValidElement(node) && (node.props as { title: string }).title).toBe(
      "Sign in required",
    );
  });

  it("renders a branded access-denied screen when authenticated but forbiddenUrl isn't configured", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
      },
    } as never);
    const node = await handleRenderError(new FlowpanelAccessError(), config);
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(isValidElement(node) && node.type).toBe(EmptyState);
    expect(isValidElement(node) && (node.props as { title: string }).title).toBe("Access denied");
  });
});

describe("renderContent — root slug on an empty config", () => {
  it("renders Welcome, not NotFound, when there are zero resources/dashboards/pages/queues", async () => {
    const config = makeConfig();
    const node = await renderContent(
      config,
      [],
      new URLSearchParams(),
      new Request("http://localhost/admin"),
    );
    expect(isValidElement(node) && node.type).toBe(Welcome);
    expect(isValidElement(node) && node.type).not.toBe(NotFound);
  });

  it("rejects Welcome on an empty config when admin-wide requireRole fails, same as sibling branches", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        requireRole: "admin",
      },
    } as never);

    await expect(
      renderContent(config, [], new URLSearchParams(), new Request("http://localhost/admin")),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("still renders NotFound for an unknown slug once the config has at least one resource", async () => {
    const resource: ResourceConfig = { __kind: "resource", ref: {}, options: { name: "users" } };
    const config = makeConfig({
      resources: [resource],
      resourcesByName: new Map([["users", resource]]),
    } as never);

    const node = await renderContent(
      config,
      ["does-not-exist"],
      new URLSearchParams(),
      new Request("http://localhost/admin/does-not-exist"),
    );
    expect(isValidElement(node) && node.type).toBe(NotFound);
  });
});
