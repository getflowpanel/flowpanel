// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../EmptyState.js";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No users" description="Add one to get started" />);
    expect(screen.getByText("No users")).toBeTruthy();
    expect(screen.getByText("Add one to get started")).toBeTruthy();
  });
  it("renders action when provided", () => {
    render(<EmptyState title="Empty" action={<button type="button">Add</button>} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });
});
