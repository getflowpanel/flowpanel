// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorState } from "../ErrorState.js";

afterEach(cleanup);

describe("ErrorState", () => {
  it("renders default title when not provided", () => {
    render(<ErrorState />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("invokes action.onClick when action button clicked", () => {
    const onClick = vi.fn();
    render(
      <ErrorState
        title="Boom"
        description="An error occurred"
        action={{ label: "Retry", onClick }}
      />,
    );
    expect(screen.getByText("Boom")).toBeTruthy();
    expect(screen.getByText("An error occurred")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
