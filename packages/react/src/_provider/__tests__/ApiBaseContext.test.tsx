import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildReferenceSearchUrl } from "../../_forms/AutoForm";
import { ApiBaseProvider, useApiBase } from "../ApiBaseContext";

function Probe() {
  return <span data-testid="base">{useApiBase()}</span>;
}

afterEach(() => cleanup());

describe("useApiBase", () => {
  it("falls back to the mounted-by-default route when no provider wraps it", () => {
    render(<Probe />);
    expect(screen.getByTestId("base").textContent).toBe("/api/flowpanel");
  });

  it("serves the configured mount point", () => {
    render(
      <ApiBaseProvider value="/internal/admin-api">
        <Probe />
      </ApiBaseProvider>,
    );
    expect(screen.getByTestId("base").textContent).toBe("/internal/admin-api");
  });
});

describe("buildReferenceSearchUrl", () => {
  it("derives the reference route from a custom mount point", () => {
    expect(
      buildReferenceSearchUrl(
        "/internal/admin-api/orders/create",
        "ownerId",
        "/internal/admin-api",
      ),
    ).toBe("/internal/admin-api/orders/reference/ownerId");
  });

  it("handles the edit form's longer action path", () => {
    expect(buildReferenceSearchUrl("/api/ops/orders/42/edit", "ownerId", "/api/ops")).toBe(
      "/api/ops/orders/reference/ownerId",
    );
  });

  it("returns nothing when the action does not sit under the mount point", () => {
    expect(
      buildReferenceSearchUrl("/somewhere/else/create", "ownerId", "/api/ops"),
    ).toBeUndefined();
  });
});
