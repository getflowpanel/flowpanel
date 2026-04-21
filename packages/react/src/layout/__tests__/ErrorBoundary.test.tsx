import { render, screen } from "@testing-library/react";
import * as React from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FlowPanelErrorBoundary } from "../ErrorBoundary";

const consoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = consoleError;
});

function Boom(): React.ReactElement {
  throw new Error("test error");
}

describe("FlowPanelErrorBoundary", () => {
  it("renders default fallback on error", () => {
    render(
      <FlowPanelErrorBoundary>
        <Boom />
      </FlowPanelErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("calls onError when child throws", () => {
    const onError = vi.fn();
    render(
      <FlowPanelErrorBoundary onError={onError}>
        <Boom />
      </FlowPanelErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
  });

  it("renders custom fallback when provided", () => {
    render(
      <FlowPanelErrorBoundary fallback={(err) => <div>Custom: {err.message}</div>}>
        <Boom />
      </FlowPanelErrorBoundary>,
    );
    expect(screen.getByText(/Custom: test error/)).toBeInTheDocument();
  });
});
