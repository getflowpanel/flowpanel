// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DetailShell } from "../DetailShell.js";

afterEach(cleanup);

describe("DetailShell", () => {
  it("renders title, subtitle, breadcrumbs, actions, and children", () => {
    render(
      <DetailShell
        title="Ada Lovelace"
        subtitle="12 active"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
        actions={<button type="button">Action</button>}
      >
        <div data-testid="slot">Slot</div>
      </DetailShell>,
    );
    expect(screen.getByRole("heading", { name: "Ada Lovelace", level: 1 })).toBeTruthy();
    expect(screen.getByText("12 active")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(screen.getByTestId("slot")).toBeTruthy();
  });
});
