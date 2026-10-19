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

describe("a failed widget's card", () => {
  it("keeps the widget's title and gives the digest the server log printed, with Retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getByText, getByRole } = render(
      <WidgetErrorBoundary widgetId="w1" title="Live operations">
        <Throws digest="1713761390" />
      </WidgetErrorBoundary>,
    );
    expect(getByText("Live operations")).toBeTruthy();
    expect(getByText("Couldn't load this widget")).toBeTruthy();
    expect(
      getByText("Try again in a moment. If it keeps failing, send this ID to your developer."),
    ).toBeTruthy();
    expect(getByText("Error 1713761390")).toBeTruthy();
    expect(getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(getByRole("button", { name: "Copy ID" })).toBeTruthy();
  });
});

describe("a failed page()", () => {
  it("keeps the page's own heading above its error card", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <WidgetErrorBoundary
        widgetId="page:/reports"
        pageTitle="Reports"
        failureTitle="Couldn't load Reports"
      >
        <Throws digest="42" />
      </WidgetErrorBoundary>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Reports");
    expect(container.querySelector("[data-fp-error]")?.textContent).toContain(
      "Couldn't load Reports",
    );
  });
});
