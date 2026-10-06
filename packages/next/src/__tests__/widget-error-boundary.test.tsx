// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { WidgetErrorBoundary } from "../runtime/WidgetErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

class Outer extends React.Component<{ children: React.ReactNode }, { digest: string | null }> {
  override state = { digest: null };
  static getDerivedStateFromError(error: { digest?: string }) {
    return { digest: error.digest ?? "none" };
  }
  override render() {
    return this.state.digest ? <p data-outer>{this.state.digest}</p> : this.props.children;
  }
}

function Throws({ digest }: { digest: string }): React.ReactNode {
  throw Object.assign(new Error(digest), { digest });
}

describe("WidgetErrorBoundary and Next's control flow", () => {
  it.each([
    ["redirect()", "NEXT_REDIRECT;replace;/billing;307;"],
    ["notFound()", "NEXT_HTTP_ERROR_FALLBACK;404"],
    ["forbidden()", "NEXT_HTTP_ERROR_FALLBACK;403"],
  ])("lets a widget's %s reach Next instead of showing an error card", (_name, digest) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <Outer>
        <WidgetErrorBoundary widgetId="w1" title="Revenue">
          <Throws digest={digest} />
        </WidgetErrorBoundary>
      </Outer>,
    );
    expect(container.querySelector("[data-fp-error]")).toBeNull();
    expect(container.querySelector("[data-outer]")?.textContent).toBe(digest);
  });

  it("still shows the error card for an ordinary failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <Outer>
        <WidgetErrorBoundary widgetId="w1" title="Revenue">
          <Throws digest="1234567" />
        </WidgetErrorBoundary>
      </Outer>,
    );
    expect(container.querySelector("[data-fp-error]")).toBeTruthy();
    expect(container.querySelector("[data-outer]")).toBeNull();
  });
});
