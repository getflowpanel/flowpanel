// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const drawn: number[] = [];

vi.mock("@flowpanel/react", () => ({
  Card: ({ children }: { children?: unknown }) => children,
  CardHeading: () => null,
}));

vi.mock("../chart-body", () => ({
  default: ({ options }: { options: { height?: number } }) => {
    drawn.push(options.height ?? -1);
    return <p data-testid="chart">{options.height}</p>;
  },
}));

import { chartBody } from "../render-chart";

const data = [{ day: "Mon", runs: 3 }];
let boxHeight = 0;
let resize: (() => void) | undefined;

beforeEach(() => {
  drawn.length = 0;
  boxHeight = 0;
  resize = undefined;
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => boxHeight);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a mounted chart", () => {
  it("with a set height draws at that height, with no measured box", async () => {
    boxHeight = 500;
    const { container } = render(
      <>
        {chartBody(
          { kind: "lineChart", options: { x: "day", y: "runs", height: 300 }, data },
          true,
        )}
      </>,
    );
    expect((await screen.findByTestId("chart")).textContent).toBe("300");
    expect(drawn.every((height) => height === 300)).toBe(true);
    expect(container.querySelector("[style*='aspect-ratio']")).toBeNull();
  });

  it("without one draws at the height its box measures, and skips a measure of 0", async () => {
    render(<>{chartBody({ kind: "lineChart", options: { x: "day", y: "runs" }, data }, true)}</>);
    expect(screen.queryByTestId("chart")).toBeNull();
    boxHeight = 296;
    act(() => resize?.());
    expect((await screen.findByTestId("chart")).textContent).toBe("296");
    boxHeight = 0;
    act(() => resize?.());
    expect(screen.getByTestId("chart").textContent).toBe("296");
    boxHeight = 320;
    act(() => resize?.());
    expect(screen.getByTestId("chart").textContent).toBe("320");
    expect(drawn).not.toContain(0);
  });
});
