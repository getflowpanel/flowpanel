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
});
