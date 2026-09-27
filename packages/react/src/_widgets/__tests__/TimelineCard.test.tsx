// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimelineCard } from "../TimelineCard";

afterEach(cleanup);

const line = (title: string, extra = {}) => ({
  key: title,
  time: "10:00",
  stamp: "Sep 25, 2026, 10:00",
  iso: "2026-09-25T10:00:00.000Z",
  title,
  ...extra,
});

describe("TimelineCard", () => {
  it("renders kind chips as links and marks the current one", () => {
    render(
      <TimelineCard
        label="Activity"
        chips={[
          { key: "", label: "All", href: "?", current: false },
          { key: "visit", label: "Visit", href: "?k=visit", current: true },
          { key: "reply", label: "Reply", href: "?k=reply", current: false },
        ]}
        groups={[]}
        emptyState="Nothing yet"
      />,
    );
    expect(screen.getByRole("link", { name: "Visit" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "All" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Visit" }).parentElement?.className).toContain(
      "flex-wrap",
    );
  });

  it("folds repeated lines and bodies into details, and titles each time", () => {
    const { container } = render(
      <TimelineCard
        chips={[]}
        groups={[
          {
            key: "d",
            label: "Today",
            count: "3 events",
            lines: [
              line("Orders in feed", {
                folded: "×2",
                span: "09:00–10:00",
                items: [line("a"), line("b")],
              }),
              line("Sent a reply", { body: "Hello there", href: "/admin/response/r1", tone: "ok" }),
            ],
          },
        ]}
        emptyState=""
        older={{ href: "?before=x", label: "Older →" }}
      />,
    );
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(screen.getByText("×2")).toBeTruthy();
    expect(screen.getByText("Hello there").closest("details")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sent a reply" }).getAttribute("href")).toBe(
      "/admin/response/r1",
    );
    expect(container.querySelector("time")?.getAttribute("title")).toBe("Sep 25, 2026, 10:00");
    expect(screen.getByRole("link", { name: "Older →" })).toBeTruthy();
    expect(screen.getByText("Orders in feed").className).toContain("break-words");
    expect(container.querySelector("summary")?.className).toContain(
      "[&::-webkit-details-marker]:hidden",
    );
  });

  it("expands a folded or bodied line from its whole row, with a chevron and no link inside", () => {
    const { container } = render(
      <TimelineCard
        label="Activity"
        chips={[
          { key: "", label: "All", href: "?", current: true },
          { key: "a", label: "A", href: "?k=a", current: false },
          { key: "b", label: "B", href: "?k=b", current: false },
        ]}
        groups={[
          {
            key: "d",
            label: "",
            count: "",
            lines: [
              line("Scoring run", {
                folded: "×2",
                href: "/admin/runs/2",
                items: [line("run 2", { href: "/admin/runs/2" }), line("run 1")],
              }),
              line("Sent a reply", { body: "Hello there", href: "/admin/response/r1" }),
            ],
          },
        ]}
        emptyState=""
      />,
    );
    const summaries = [...container.querySelectorAll("summary")];
    expect(summaries).toHaveLength(2);
    for (const summary of summaries) {
      expect(summary.querySelector("a")).toBeNull();
      expect(summary.querySelector("svg")?.getAttribute("class")).toContain(
        "[details[open]>summary_&]:rotate-90",
      );
    }
    expect(screen.queryByRole("link", { name: "Scoring run" })).toBeNull();
    expect(screen.getByRole("link", { name: "run 2" }).getAttribute("href")).toBe("/admin/runs/2");
    const reply = screen.getByRole("link", { name: "Sent a reply" });
    expect(reply.closest("summary")).toBeNull();
    expect(reply.closest("details")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Activity" }).querySelectorAll("a")).toHaveLength(3);
    expect(container.querySelector("nav")).toBeNull();
  });
});
