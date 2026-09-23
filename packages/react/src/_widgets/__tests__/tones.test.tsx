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
  default: "text-fp-text-1",
  accent: "text-fp-accent-badge-text",
  ok: "text-fp-ok-text",
  warn: "text-fp-warn-text",
  err: "text-fp-err-text",
  info: "text-fp-info-text",
  muted: "text-fp-text-3",
};

const FILL: Record<Tone, string> = {
  default: "bg-fp-accent",
  accent: "bg-fp-accent",
  ok: "bg-fp-ok",
  warn: "bg-fp-warn",
  err: "bg-fp-err",
  info: "bg-fp-info",
  muted: "bg-fp-text-3",
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
    expect(container.querySelector("[data-tone] .h-full.rounded-full")?.className).toContain(
      FILL[tone],
    );
  });

  it("marks a list row with a dot, and colours its text for warn and err", () => {
    const { container } = render(<ListCard rows={[{ text: "Deploy", tone }]} />);
    const dot = container.querySelector("li [data-tone-dot]");
    if (tone === "default") expect(dot).toBeNull();
    else expect(dot?.className).toContain(FILL[tone]);
    const text = screen.getByText("Deploy").className;
    if (tone === "warn" || tone === "err") expect(text).toContain(TEXT[tone]);
    else expect(text).toContain("text-fp-text-1");
  });
});

it("keeps an untoned list row without a dot", () => {
  const { container } = render(<ListCard rows={[{ text: "Deploy" }]} />);
  expect(container.querySelector("[data-tone-dot]")).toBeNull();
});
