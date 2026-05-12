// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminShell } from "../AdminShell.js";
import { useComponents } from "../../_provider/ComponentsContext.js";

afterEach(() => cleanup());

function Probe() {
  const { EmptyState } = useComponents();
  return <EmptyState title="probe" />;
}

describe("AdminShell — themeComponents prop", () => {
  it("wraps children in ComponentsProvider with the override applied", () => {
    function Custom({ title }: { title: string }) {
      return <div data-testid="custom-empty">{title.toUpperCase()}</div>;
    }
    render(
      <AdminShell navGroups={[]} currentPath="/admin" themeComponents={{ EmptyState: Custom }}>
        <Probe />
      </AdminShell>,
    );
    expect(screen.getByTestId("custom-empty").textContent).toBe("PROBE");
  });

  it("renders the default EmptyState when no override given", () => {
    render(
      <AdminShell navGroups={[]} currentPath="/admin">
        <Probe />
      </AdminShell>,
    );
    expect(screen.getByText("probe")).toBeTruthy();
  });
});
