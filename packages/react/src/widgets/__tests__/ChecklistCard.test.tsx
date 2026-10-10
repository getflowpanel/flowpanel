// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChecklistCard, type ChecklistCardItem } from "../ChecklistCard";

afterEach(cleanup);

const items: ChecklistCardItem[] = [
  { key: "a", label: "Published", state: "done", mark: "Done", date: "Sep 24, 2026" },
  {
    key: "b",
    label: "Scored",
    state: "done",
    mark: "Done",
    date: "Sep 24, 2026, 10:05",
    gap: "+5 min",
    href: "/orders/o1",
    tone: "accent",
  },
  { key: "c", label: "Telegram", state: "optional", mark: "Optional", hint: "Linked in the bot" },
  { key: "d", label: "Notified", state: "todo", mark: "Not done" },
];

describe("ChecklistCard", () => {
  it("marks each item and draws the summary bar", () => {
    const { container } = render(
      <ChecklistCard
        label="Trace"
        items={items}
        summary={{ text: "2 of 3", share: 2 / 3 }}
        emptyState=""
      />,
    );
    const done = screen.getAllByRole("img", { name: "Done" });
    expect(done).toHaveLength(2);
    expect(done[0]?.className).toContain("fp-text-ok-ink");
    expect(done[1]?.className).toContain("fp-text-accent-ink");
    expect(screen.getByRole("img", { name: "Optional" }).textContent).toBe("–");
    expect(screen.getByRole("img", { name: "Not done" }).textContent).toBe("○");
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(container.querySelector("[data-share]")?.className).toContain("fp-w-[65%]");
    expect(screen.getByRole("link", { name: "Scored" }).getAttribute("href")).toBe("/orders/o1");
    expect(screen.getByText("Sep 24, 2026, 10:05 · +5 min")).toBeTruthy();
    expect(screen.getByText("Linked in the bot")).toBeTruthy();
  });

  it("lays steps out in a row from md and in a column on a phone", () => {
    const { container } = render(<ChecklistCard items={items} layout="steps" emptyState="" />);
    const list = container.querySelector("ol") as HTMLElement;
    expect(list.className).toContain("fp-flex-col");
    expect(list.className).toContain("md:fp-flex-row");
    expect(container.querySelector("[data-share]")).toBeNull();
    expect(screen.getByText("Published").className).toContain("fp-break-words");
  });

  it("shows the empty state without items", () => {
    render(<ChecklistCard items={[]} emptyState="Nothing to check" />);
    expect(screen.getByText("Nothing to check")).toBeTruthy();
  });
});
