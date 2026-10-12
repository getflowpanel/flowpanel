// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCard } from "../../_widgets/MetricCard";
import { StatCard } from "../../_widgets/StatCard";
import { CardHeader } from "../Card";
import { SectionLabel } from "../Section";

afterEach(() => cleanup());

function weightOf(el: HTMLElement | null): string[] {
  const classes: string[] = [];
  for (let node = el; node; node = node.parentElement) {
    for (const c of node.classList)
      if (/^font-(normal|medium|semibold|bold)$/.test(c)) classes.push(c);
  }
  return classes;
}

describe("card and section titles", () => {
  it("sets a card title in text-2 at regular weight", () => {
    render(<CardHeader>Runs</CardHeader>);
    const title = screen.getByText("Runs");
    expect(title.className).toContain("fp-text-soft");
    expect(title.className).not.toContain("fp-text-ink");
    expect(weightOf(title)).toEqual([]);
  });

  it("keeps metric and stat titles at regular weight", () => {
    render(
      <>
        <MetricCard label="Orders" value={12} />
        <StatCard label="Queue" value={3} />
      </>,
    );
    expect(weightOf(screen.getByText("Orders"))).toEqual([]);
    expect(weightOf(screen.getByText("Queue"))).toEqual([]);
  });

  it("sets a section title in text-1 at semibold", () => {
    render(<SectionLabel label="Pipeline" />);
    const title = screen.getByRole("heading", { name: "Pipeline" });
    expect(title.className).toContain("fp-text-ink");
    expect(title.className).toContain("fp-font-semibold");
  });
});
