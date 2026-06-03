import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "../useMediaQuery.js";

class MockMediaQueryList {
  matches: boolean;
  private listeners = new Set<() => void>();
  constructor(
    public media: string,
    initial: boolean,
  ) {
    this.matches = initial;
  }
  addEventListener(_type: "change", cb: () => void): void {
    this.listeners.add(cb);
  }
  removeEventListener(_type: "change", cb: () => void): void {
    this.listeners.delete(cb);
  }
  /** Test helper: flip the match state and fire change listeners. */
  set(matches: boolean): void {
    this.matches = matches;
    for (const cb of this.listeners) cb();
  }
}

let mql: MockMediaQueryList;

const Harness: React.FC<{ query: string }> = ({ query }) => {
  const matches = useMediaQuery(query);
  return <div data-testid="result">{String(matches)}</div>;
};

describe("useMediaQuery", () => {
  beforeEach(() => {
    mql = new MockMediaQueryList("(max-width: 639px)", false);
    vi.stubGlobal(
      "matchMedia",
      vi.fn((q: string) => {
        mql.media = q;
        return mql;
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("returns false on the server snapshot even when matchMedia would match", () => {
    // `getServerSnapshot` is pinned to `false`. `renderToString` drives the
    // server path: even with a matching `matchMedia`, the SSR markup must read
    // `false` (the desktop-default layout) to keep hydration deterministic.
    mql = new MockMediaQueryList("(max-width: 639px)", true);
    const html = renderToString(<Harness query="(max-width: 639px)" />);
    expect(html).toContain(">false<");
  });

  it("reflects the current matchMedia match on mount", () => {
    mql = new MockMediaQueryList("(max-width: 639px)", true);
    const { getByTestId } = render(<Harness query="(max-width: 639px)" />);
    expect(getByTestId("result").textContent).toBe("true");
  });

  it("re-renders when the media query flips via a change event", () => {
    const { getByTestId } = render(<Harness query="(max-width: 639px)" />);
    expect(getByTestId("result").textContent).toBe("false");
    act(() => mql.set(true));
    expect(getByTestId("result").textContent).toBe("true");
    act(() => mql.set(false));
    expect(getByTestId("result").textContent).toBe("false");
  });
});
