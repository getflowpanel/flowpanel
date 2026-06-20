// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader } from "../Card.js";
import { Section, spanClass } from "../Section.js";

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
  it("maps every declared Span value to its col-span-N utility", () => {
    expect(spanClass).toEqual({
      1: "col-span-1",
      2: "col-span-2",
      3: "col-span-3",
      4: "col-span-4",
      6: "col-span-6",
      8: "col-span-8",
      12: "col-span-12",
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
