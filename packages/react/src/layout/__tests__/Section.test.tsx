// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader } from "../Card";
import { Section, spanClass } from "../Section";

afterEach(() => cleanup());

describe("Section", () => {
  it("renders label and children", () => {
    render(
      <Section label="Today" columns={4}>
        <div>child</div>
      </Section>,
    );
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("applies 4-column grid class when columns=4", () => {
    const { container } = render(
      <Section columns={4}>
        <div />
      </Section>,
    );
    expect(container.querySelector(".grid-cols-4, [data-columns='4']")).toBeTruthy();
  });

  it("renders description when given", () => {
    render(
      <Section label="Signups" description="Last 7 days">
        <div />
      </Section>,
    );
    expect(screen.getByText("Last 7 days")).toBeTruthy();
  });

  it("renders supporting copy without forcing a redundant section heading", () => {
    const { container } = render(
      <Section description="Monitor customer catalogs and marketplace coverage.">
        <div>metrics</div>
      </Section>,
    );

    expect(container.querySelector("h2")).toBeNull();
    expect(screen.getByText("Monitor customer catalogs and marketplace coverage.")).toBeTruthy();
  });

  it("omits label block when no label", () => {
    const { container } = render(
      <Section>
        <div>only-child</div>
      </Section>,
    );
    expect(container.querySelector("h2")).toBeNull();
    expect(screen.getByText("only-child")).toBeTruthy();
  });
});

describe("spanClass", () => {
  it("stacks widgets on phones and restores every span from 1 to 12 from sm", () => {
    expect(spanClass).toEqual({
      1: "fp-col-span-12 sm:fp-col-span-1",
      2: "fp-col-span-12 sm:fp-col-span-2",
      3: "fp-col-span-12 sm:fp-col-span-3",
      4: "fp-col-span-12 sm:fp-col-span-4",
      5: "fp-col-span-12 sm:fp-col-span-5",
      6: "fp-col-span-12 sm:fp-col-span-6",
      7: "fp-col-span-12 sm:fp-col-span-7",
      8: "fp-col-span-12 sm:fp-col-span-8",
      9: "fp-col-span-12 sm:fp-col-span-9",
      10: "fp-col-span-12 sm:fp-col-span-10",
      11: "fp-col-span-12 sm:fp-col-span-11",
      12: "fp-col-span-12",
    });
  });
});

describe("Card", () => {
  it("composes header + content", () => {
    render(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
  });
});
