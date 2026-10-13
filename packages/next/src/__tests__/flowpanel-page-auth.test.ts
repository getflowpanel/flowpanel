import type {
  DashboardConfig,
  PageConfig,
  QueueConfig,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelAccessError, FlowpanelAuthError } from "@flowpanel/core";
import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn((url: string) => {
  // Mirrors Next's real `redirect()`: throws a control-flow error that must
  // propagate out of the caller, not get swallowed.
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
  throw err;
});
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectSpy(url),
  notFound: () => {
    throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND });
  },
}));

import { handleRenderError, renderContent } from "../flowpanel-page";
import { DashboardPage } from "../pages/dashboard";
import { QueuePage } from "../pages/queue-page";
import { ResourceListPage } from "../pages/resource-list";
import { UserPage } from "../pages/user-page";
import { Wall } from "../pages/wall";
import { Welcome } from "../pages/welcome";
import { DevAuthNote, devAuthNote } from "../runtime/dev-auth-note";

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
    paths: { admin: "/admin", api: "/api/flowpanel" },
    __resolved: true,
    ...overrides,
  } as ResolvedAdminConfig;
}

describe("renderContent — admin-wide access", () => {
  it("opens the first resource the caller can read, not merely the first visible resource", async () => {
    const denied = {
      __kind: "resource",
      ref: { __name: "secrets" },
      options: { columns: [], access: { read: async () => false } },
    } as ResourceConfig;
    const allowed = {
      __kind: "resource",
      ref: { __name: "customers" },
      options: { columns: [], access: { read: async () => true } },
    } as ResourceConfig;
    const config = makeConfig({
      resources: [denied, allowed],
      resourcesByName: new Map([
        ["secrets", denied],
        ["customers", allowed],
      ]),
    });

    const node = await renderContent(
      config,
      [],
      new URLSearchParams(),
      new Request("http://localhost/admin"),
    );

    expect(isValidElement(node) && node.type).toBe(ResourceListPage);
    expect(isValidElement(node) && (node.props as { resource: ResourceConfig }).resource).toBe(
      allowed,
    );
  });

  it("rejects a dashboard render when admin-wide access fails, even without its own gate", async () => {
    const dash: DashboardConfig = { path: "/", label: "Home", sections: [] };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        access: "admin",
      },
      dashboards: [dash],
      dashboardsByPath: new Map([["/", dash]]),
    } as never);

    await expect(
      renderContent(config, [], new URLSearchParams(), new Request("http://localhost/admin")),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("renders the dashboard when admin-wide access passes and the dashboard has no own gate", async () => {
    const dash: DashboardConfig = { path: "/", label: "Home", sections: [] };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        access: "admin",
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

  it("rejects a user page render when admin-wide access fails, even without its own gate", async () => {
    const page: PageConfig = { path: "/reports", label: "Reports", component: () => null };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        access: "admin",
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

  it("renders the user page when admin-wide access passes and the page has no own gate", async () => {
    const page: PageConfig = { path: "/reports", label: "Reports", component: () => null };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        access: "admin",
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

  it("rejects a queue render when admin-wide access fails, even without its own gate", async () => {
    const queue: QueueConfig = {
      __kind: "queue",
      ref: {} as never,
      options: { label: "Scraper", boardUrl: "http://localhost:3001" },
    };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        access: "admin",
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

  it("renders the queue when admin-wide access passes and the queue has no own gate", async () => {
    const queue: QueueConfig = {
      __kind: "queue",
      ref: {} as never,
      options: { label: "Scraper", boardUrl: "http://localhost:3001" },
    };
    const billing: QueueConfig = {
      __kind: "queue",
      ref: {} as never,
      options: { label: "Billing", boardUrl: "http://localhost:3001/billing", hidden: true },
    };
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: () => "admin",
        access: "admin",
      },
      queuesByKey: new Map([
        ["scraper", queue],
        ["billing", billing],
      ]),
    } as never);

    const node = await renderContent(
      config,
      ["queues", "scraper"],
      new URLSearchParams(),
      new Request("http://localhost/admin/queues/scraper"),
    );
    expect(isValidElement(node) && node.type).toBe(QueuePage);
    expect(
      isValidElement(node) &&
        (node.props as { navigation: Array<{ label: string; href: string }> }).navigation,
    ).toEqual([
      { label: "Scraper", href: "/admin/queues/scraper", active: true },
      { label: "Billing", href: "/admin/queues/billing", active: false },
    ]);
  });
});

describe("handleRenderError", () => {
  beforeEach(() => {
    redirectSpy.mockClear();
  });

  it("re-throws errors that aren't FlowpanelAuthError/FlowpanelAccessError", async () => {
    const config = makeConfig();
    const boom = new Error("db exploded");
    await expect(
      handleRenderError(boom, config, new Request("http://localhost/admin")),
    ).rejects.toBe(boom);
  });

  it("redirects to signInUrl when unauthenticated (session() returns null)", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest", signInUrl: "/sign-in" },
    } as never);
    await expect(
      handleRenderError(new FlowpanelAccessError(), config, new Request("http://localhost/admin")),
    ).rejects.toThrow("NEXT_REDIRECT:/sign-in");
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
    await expect(
      handleRenderError(new FlowpanelAccessError(), config, new Request("http://localhost/admin")),
    ).rejects.toThrow("NEXT_REDIRECT:/403");
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
    await expect(
      handleRenderError(new FlowpanelAuthError(), config, new Request("http://localhost/admin")),
    ).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirectSpy).toHaveBeenCalledWith("/sign-in");
  });

  it("renders a branded sign-in screen when unauthenticated and signInUrl isn't configured", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest" },
    } as never);
    const node = await handleRenderError(
      new FlowpanelAccessError(),
      config,
      new Request("http://localhost/admin"),
    );
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(isValidElement(node) && node.type).toBe(Wall);
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
    const node = await handleRenderError(
      new FlowpanelAccessError(),
      config,
      new Request("http://localhost/admin"),
    );
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(isValidElement(node) && node.type).toBe(Wall);
    expect(isValidElement(node) && (node.props as { title: string }).title).toBe(
      "You don't have access to this admin",
    );
  });
});

describe("the sign-in wall for a developer", () => {
  const signedOut = () =>
    makeConfig({ auth: { session: async () => null, role: () => "guest" } } as never);
  const wall = async () =>
    (await handleRenderError(
      new FlowpanelAccessError(),
      signedOut(),
      new Request("http://localhost/admin"),
    )) as ReactElement<{ children?: ReactElement | null }>;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("puts the development note under the description outside production", async () => {
    const node = await wall();
    expect(node.type).toBe(Wall);
    expect(node.props.children?.type).toBe(DevAuthNote);
  });

  it("warns the same sentence once per process", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { FlowpanelAccessError: FreshAccessError } = await import("@flowpanel/core");
    const { handleRenderError: fresh } = await import("../flowpanel-page");
    const config = signedOut();
    await fresh(new FreshAccessError(), config, new Request("http://localhost/admin"));
    await fresh(new FreshAccessError(), config, new Request("http://localhost/admin"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`[flowpanel] ${devAuthNote()}`);
  });

  it("leaves production output unchanged", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const node = await wall();
    expect(node.props.children).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("adds no note to the access-denied wall", async () => {
    const node = (await handleRenderError(
      new FlowpanelAccessError(),
      makeConfig({
        auth: { session: async () => ({ user: { id: "u1" } }), role: () => "viewer" },
      } as never),
      new Request("http://localhost/admin"),
    )) as ReactElement<{ children?: unknown }>;
    expect(node.props.children).toBeUndefined();
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
  });

  it("rejects Welcome on an empty config when admin-wide access fails, same as sibling branches", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: () => "viewer",
        access: "admin",
      },
    } as never);

    await expect(
      renderContent(config, [], new URLSearchParams(), new Request("http://localhost/admin")),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it.each([
    ["an unknown resource", ["does-not-exist"]],
    ["an unknown queue", ["queues", "nope"]],
    ["an unknown record sub-path", ["users", "u1", "nope"]],
  ])("is a 404 for %s once the config has at least one resource", async (_name, slug) => {
    const resource: ResourceConfig = { __kind: "resource", ref: {}, options: { name: "users" } };
    const config = makeConfig({
      resources: [resource],
      resourcesByName: new Map([["users", resource]]),
    } as never);

    await expect(
      renderContent(
        config,
        slug,
        new URLSearchParams(),
        new Request(`http://localhost/admin/${slug.join("/")}`),
      ),
    ).rejects.toMatchObject({ digest: NOT_FOUND });
  });

  it("lets the 404 pass the render-error boundary", async () => {
    const boom = Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND });
    await expect(
      handleRenderError(boom, makeConfig(), new Request("http://localhost/admin/nope")),
    ).rejects.toBe(boom);
  });
});
