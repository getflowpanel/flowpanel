// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useComponents } from "../../_provider/ComponentsContext.js";
import { AdminShell } from "../AdminShell.js";
import { FlowpanelGlobals } from "../FlowpanelGlobals.js";

afterEach(() => cleanup());

function Probe() {
  const { EmptyState } = useComponents();
  return <EmptyState title="probe" />;
}

describe("FlowpanelGlobals — themeComponents prop", () => {
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
