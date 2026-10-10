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
    expect(band).toContain("fp-gap-px");
    expect(band).toContain("fp-grid-cols-2");
    expect(band).toContain("md:fp-grid-cols-3");
    expect(band).toContain("[&>*:last-child:nth-child(odd)]:fp-col-span-2");
    expect(band).toContain("[&>*]:fp-bg-surface");
  });

  it("takes an explicit number of cells per line, at most six by default", () => {
    render(
      <StatStrip columns={2}>
        <div>x</div>
      </StatStrip>,
    );
    expect(screen.getByText("x").parentElement?.className).toContain("md:fp-grid-cols-2");
    cleanup();
    render(
      <StatStrip>
        {Array.from({ length: 8 }, (_, i) => `n${i}`).map((name) => (
          <div key={name}>{name}</div>
        ))}
      </StatStrip>,
    );
    expect(screen.getByText("n0").parentElement?.className).toContain("md:fp-grid-cols-6");
  });

  it("draws the hairlines on the cells, so slots left empty on the last line stay blank", () => {
    render(
      <StatStrip>
        {Array.from({ length: 7 }, (_, i) => `k${i}`).map((name) => (
          <div key={name}>{name}</div>
        ))}
      </StatStrip>,
    );
    const band = screen.getByText("k0").parentElement?.className ?? "";
    expect(band).not.toContain("fp-bg-line");
    expect(band).toContain("fp-bg-surface");
    expect(band).toContain("[&>*]:fp-shadow-[0_0_0_1px_hsl(var(--fp-border-1))]");
  });

  it("counts only the cells that render, so a hidden one leaves no empty column", () => {
    const show = false;
    render(
      <StatStrip>
        <div>a</div>
        {show && <div>b</div>}
        {null}
      </StatStrip>,
    );
    expect(screen.getByText("a").parentElement?.className).toContain("md:fp-grid-cols-1");
  });
});
