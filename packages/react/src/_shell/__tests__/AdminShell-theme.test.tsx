// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// FlowpanelGlobals mounts RealtimeProvider, which calls useRouter for the
// coalesced refresh. Provide a router stub so these unrelated tests render.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { useComponents } from "../../_provider/useComponents";
import { AdminShell } from "../AdminShell";
import { FlowpanelGlobals } from "../FlowpanelGlobals";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.flowpanelTheme;
});

function Probe() {
  const { EmptyState } = useComponents();
  return <EmptyState title="probe" />;
}

describe("FlowpanelGlobals — themeComponents prop", () => {
  it("applies the configured theme after a client-side mount", async () => {
    localStorage.removeItem("fp-theme");
    render(
      <FlowpanelGlobals themeMode="dark">
        <div>content</div>
      </FlowpanelGlobals>,
    );

    await vi.waitFor(() => expect(document.documentElement.dataset.flowpanelTheme).toBe("dark"));
    expect(document.querySelector("[data-flowpanel-root]")?.getAttribute("data-theme")).toBe(
      "dark",
    );
  });

  it("provides ComponentsProvider with the override applied", () => {
    function Custom({ title }: { title: string }) {
      return <div data-testid="custom-empty">{title.toUpperCase()}</div>;
    }
    render(
      <FlowpanelGlobals themeComponents={{ EmptyState: Custom }}>
        <Probe />
      </FlowpanelGlobals>,
    );
    expect(screen.getByTestId("custom-empty").textContent).toBe("PROBE");
  });

  it("renders the default EmptyState when no override given", () => {
    render(
      <FlowpanelGlobals>
        <Probe />
      </FlowpanelGlobals>,
    );
    expect(screen.getByText("probe")).toBeTruthy();
  });
});

describe("AdminShell — variant prop", () => {
  it("renders sidebar nav by default", () => {
    render(
      <FlowpanelGlobals>
        <AdminShell
          navGroups={[{ items: [{ label: "Users", href: "/admin/users" }] }]}
          currentPath="/admin"
        >
          <div>content</div>
        </AdminShell>
      </FlowpanelGlobals>,
    );
    const navs = screen.getAllByRole("navigation", { name: "Admin" });
    expect(navs.length).toBe(1);
    // Sidebar element is a <nav>
    expect(navs[0]?.tagName).toBe("NAV");
  });

  it("renders tabs strip when variant='tabs'", () => {
    render(
      <FlowpanelGlobals>
        <AdminShell
          variant="tabs"
          navGroups={[{ items: [{ label: "Users", href: "/admin/users" }] }]}
          currentPath="/admin/users"
        >
          <div>content</div>
        </AdminShell>
      </FlowpanelGlobals>,
    );
    // Tab strip uses role=navigation on a div, with the active tab marked aria-current
    const active = screen.getByText("Users").closest("a");
    expect(active?.getAttribute("aria-current")).toBe("page");
  });
});
