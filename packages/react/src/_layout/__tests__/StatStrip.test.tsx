// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatStrip } from "../StatStrip";

afterEach(cleanup);

describe("StatStrip", () => {
  it("draws hairlines between cells, two per line on a phone and one line from md up", () => {
    render(
      <StatStrip label="Today">
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </StatStrip>,
    );
    expect(screen.getByText("Today")).toBeTruthy();
    const band = screen.getByText("a").parentElement?.className ?? "";
    expect(band).toContain("gap-px");
    expect(band).toContain("bg-fp-border-1");
    expect(band).toContain("grid-cols-2");
    expect(band).toContain("md:grid-cols-3");
    expect(band).toContain("[&>*:last-child:nth-child(odd)]:col-span-2");
    expect(band).toContain("[&>*]:bg-fp-bg-1");
  });

  it("takes an explicit number of cells per line, at most six by default", () => {
    render(
      <StatStrip columns={2}>
        <div>x</div>
      </StatStrip>,
    );
    expect(screen.getByText("x").parentElement?.className).toContain("md:grid-cols-2");
    cleanup();
    render(
      <StatStrip>
        {Array.from({ length: 8 }, (_, i) => `n${i}`).map((name) => (
          <div key={name}>{name}</div>
        ))}
      </StatStrip>,
    );
    expect(screen.getByText("n0").parentElement?.className).toContain("md:grid-cols-6");
  });
});
