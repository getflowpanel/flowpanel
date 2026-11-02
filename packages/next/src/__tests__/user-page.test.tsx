// @vitest-environment happy-dom

import type { PageProps, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { bindFormat, page } from "@flowpanel/core";
import { FlowpanelGlobals } from "@flowpanel/react";
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { UserPage } from "../pages/user-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const config = {
  formatting: { locale: "de-DE", timeZone: "Europe/Berlin", currency: "EUR" },
} as unknown as ResolvedAdminConfig;

const reqCtx = {
  requestId: "r1",
  req: new Request("http://localhost/admin/reports"),
  session: { user: { id: "maria" } },
  role: "manager",
  scope: { orgId: 1 },
  ip: null,
  userAgent: null,
} as RequestContext;

function show(component: (props: PageProps) => React.ReactNode) {
  const reports = page({ path: "/reports", label: "Reports", component });
  render(
    <FlowpanelGlobals>
      <UserPage
        page={reports}
        config={config}
        reqCtx={reqCtx}
        searchParams={new URLSearchParams("year=2026")}
      />
    </FlowpanelGlobals>,
  );
}

describe("a page() component", () => {
  it("gets the reader, the tenant, the admin's formatting and labels as props", () => {
    show(({ session, role, scope, formatting, labels, searchParams }) => (
      <p>
        {[
          (session as { user: { id: string } }).user.id,
          role,
          String(scope?.orgId),
          bindFormat(formatting).money(1999, { minorUnits: 2 }),
          labels.actions.new,
          searchParams.year,
        ].join(" | ")}
      </p>
    ));
    expect(screen.getByText("maria | manager | 1 | 19,99 € | New | 2026")).toBeTruthy();
  });

  it("that throws shows an error card inside the admin instead of taking it down", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    show(() => {
      throw new Error("integer out of range");
    });
    expect(screen.getByText("Reports")).toBeTruthy();
    expect(screen.getByText("Couldn't load reports")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

describe('a "use client" page() component', () => {
  it("gets no session or scope, so a provider's tokens never reach the browser", () => {
    const ClientPage = Object.assign((_props: PageProps) => null, {
      $$typeof: Symbol.for("react.client.reference"),
    });
    const tree = UserPage({
      page: page({ path: "/reports", label: "Reports", component: ClientPage }),
      config,
      reqCtx,
      searchParams: new URLSearchParams(),
    });
    const props = findProps(tree, ClientPage);
    expect(props).toMatchObject({ session: null, scope: null, role: "manager" });
  });
});

function findProps(tree: unknown, type: unknown): Record<string, unknown> | undefined {
  if (!isValidElement(tree)) return undefined;
  const element = tree as ReactElement<Record<string, unknown> & { children?: unknown }>;
  if (element.type === type) return element.props;
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findProps(child, type);
    if (found) return found;
  }
  return undefined;
}
