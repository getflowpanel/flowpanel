import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../components/ErrorBoundary.js";

function Bomb(): JSX.Element {
  throw new Error("Boom!");
}

describe("ErrorBoundary", () => {
  it("catches render error and shows fallback", () => {
    // Suppress React's console.error for the expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Boom!")).toBeInTheDocument();

    spy.mockRestore();
  });
});
