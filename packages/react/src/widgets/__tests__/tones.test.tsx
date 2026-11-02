// @vitest-environment happy-dom

import type { Tone } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarsCard } from "../BarsCard";
import { KvCard } from "../KvCard";
import { ListCard } from "../ListCard";
import { DefaultMetricCard } from "../MetricCardDefault";
import { StatCard } from "../StatCard";
import { StatGroupCard } from "../StatGroupCard";

afterEach(cleanup);

const TEXT: Record<Tone, string> = {
  default: "fp-text-ink",
  accent: "fp-text-accent-ink",
  ok: "fp-text-ok-ink",
  warn: "fp-text-warn-ink",
  err: "fp-text-err-ink",
  info: "fp-text-info-ink",
  muted: "fp-text-faint",
};

const FILL: Record<Tone, string> = {
  default: "fp-bg-data",
  accent: "fp-bg-accent",
  ok: "fp-bg-ok",
  warn: "fp-bg-warn",
  err: "fp-bg-err",
  info: "fp-bg-info",
  muted: "fp-bg-faint",
};

const tones = Object.keys(TEXT) as Tone[];

describe.each(tones)("tone %s", (tone) => {
  it("colours a stat value", () => {
    render(<StatCard label="Runs" value="7" tone={tone} />);
    expect(screen.getByText("7").className).toContain(TEXT[tone]);
  });

  it("colours a metric value", () => {
    render(<DefaultMetricCard label="Runs" value="7" tone={tone} />);
    expect(screen.getByText("7").className).toContain(TEXT[tone]);
  });

  it("colours a stat group value", () => {
    render(<StatGroupCard stats={[{ label: "Runs", value: "7", tone }]} />);
    expect(screen.getByText("7").className).toContain(TEXT[tone]);
  });

  it("colours a kv value", () => {
    render(<KvCard items={[{ label: "Runs", value: "7", tone }]} />);
    expect(screen.getByText("7").className).toContain(TEXT[tone]);
  });

  it("fills a bar with the tone", () => {
    const { container } = render(<BarsCard rows={[{ label: "Runs", value: 7, tone }]} />);
    expect(container.querySelector("[data-tone] .fp-h-full.fp-rounded-full")?.className).toContain(
      FILL[tone],
    );
  });

  it("marks a list row with a dot and keeps its text in the body colour", () => {
    const { container } = render(<ListCard rows={[{ text: "Deploy", tone }]} />);
    const dot = container.querySelector("li [data-tone-dot]");
    if (tone === "default") expect(dot).toBeNull();
    else expect(dot?.className).toContain(FILL[tone]);
    expect(screen.getByText("Deploy").className).toContain("fp-text-ink");
  });
});

it("keeps an untoned list row without a dot", () => {
  const { container } = render(<ListCard rows={[{ text: "Deploy" }]} />);
  expect(container.querySelector("[data-tone-dot]")).toBeNull();
});
