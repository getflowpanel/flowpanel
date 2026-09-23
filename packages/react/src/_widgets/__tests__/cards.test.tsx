// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarsCard } from "../BarsCard";
import { FunnelCard } from "../FunnelCard";
import { KvCard } from "../KvCard";
import { ListCard } from "../ListCard";
import { StatCard } from "../StatCard";
import { StatGroupCard } from "../StatGroupCard";

afterEach(cleanup);

describe("StatCard", () => {
  it("renders the label, the formatted value and the hint", () => {
    render(<StatCard label="Signups" value={1234} format="number" hint="last 7 days" />);
    expect(screen.getByText("Signups")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("last 7 days")).toBeTruthy();
  });

  it("marks the tone on the card and links the whole card for an href", () => {
    render(<StatCard label="Failures" value="3" tone="err" href="/admin/runs" />);
    const link = screen.getByRole("link", { name: "Failures" });
    expect(link.getAttribute("href")).toBe("/admin/runs");
    expect(link.querySelector("[data-tone='err']")).toBeTruthy();
  });

  it("titles the card like a metric card, in sentence case", () => {
    render(<StatCard label="Notifications delivered" value={3} />);
    const title = screen.getByText("Notifications delivered").className;
    expect(title).toContain("text-sm");
    expect(title).toContain("text-fp-text-2");
    expect(title).not.toContain("uppercase");
  });

  it("renders a string value verbatim", () => {
    render(<StatCard label="Plan" value="Enterprise" />);
    expect(screen.getByText("Enterprise")).toBeTruthy();
  });
});

describe("KvCard", () => {
  it("renders every item with its tone and links the ones that have an href", () => {
    render(
      <KvCard
        label="Account"
        items={[
          { label: "Seats", value: "12" },
          { label: "Overdue", value: "$40", tone: "warn", href: "/admin/invoices" },
        ]}
      />,
    );
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    const link = screen.getByRole("link", { name: "$40" });
    expect(link.getAttribute("href")).toBe("/admin/invoices");
    expect(screen.getByText("Overdue").parentElement?.getAttribute("data-tone")).toBe("warn");
  });
});

describe("BarsCard", () => {
  it("sizes each bar against the largest row and formats the values", () => {
    const { container } = render(
      <BarsCard
        label="Top plans"
        rows={[
          { label: "Pro", value: 800 },
          { label: "Free", value: 400 },
        ]}
      />,
    );
    expect(screen.getByText("800")).toBeTruthy();
    const bars = container.querySelectorAll(".bg-fp-accent");
    expect(bars[0]?.className).toContain("w-full");
    expect(bars[1]?.className).toContain("w-[50%]");
  });

  it("sizes bars against a declared max instead of the largest row", () => {
    const { container } = render(
      <BarsCard
        rows={[
          { label: "0–20%", value: 0.45 },
          { label: "20–40%", value: 0.1 },
        ]}
        format="percent"
        max={1}
      />,
    );
    const bars = container.querySelectorAll(".bg-fp-accent");
    expect(bars[0]?.className).toContain("w-[45%]");
    expect(bars[1]?.className).toContain("w-[10%]");
  });

  it("treats a max of zero or less as unset", () => {
    const { container } = render(
      <BarsCard
        rows={[
          { label: "Pro", value: 8 },
          { label: "Free", value: 4 },
        ]}
        max={0}
      />,
    );
    const bars = container.querySelectorAll(".bg-fp-accent");
    expect(bars[0]?.className).toContain("w-full");
    expect(bars[1]?.className).toContain("w-[50%]");
  });

  it("keys bars by position, so two equal labels raise no warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <BarsCard
        rows={[
          { label: "Other", value: 3 },
          { label: "Other", value: 2 },
        ]}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("renders the empty state instead of bars when there are none", () => {
    render(<BarsCard label="Top plans" rows={[]} emptyState="No data yet" />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });
});

describe("FunnelCard", () => {
  it("derives the share of the first step and the drop-off from the previous one", () => {
    render(
      <FunnelCard
        steps={[
          { label: "Visited", value: 1000 },
          { label: "Signed up", value: 250 },
          { label: "Paid", value: 50 },
        ]}
      />,
    );
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("5%")).toBeTruthy();
    expect(screen.getByText("−75%")).toBeTruthy();
    expect(screen.getByText("−80%")).toBeTruthy();
  });

  it("gives the first step no drop-off", () => {
    const { container } = render(<FunnelCard steps={[{ label: "Visited", value: 10 }]} />);
    expect(container.textContent).not.toContain("−");
  });

  it("renders the empty state for no steps", () => {
    render(<FunnelCard steps={[]} emptyState="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });
});

describe("ListCard", () => {
  it("renders text, meta, tone and links", () => {
    render(
      <ListCard
        label="Latest signups"
        rows={[{ text: "ann@example.com", meta: "2m", tone: "ok", href: "/admin/users/1" }]}
      />,
    );
    expect(screen.getByText("2m")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ann@example.com" }).getAttribute("href")).toBe(
      "/admin/users/1",
    );
    expect(screen.getByRole("listitem").getAttribute("data-tone")).toBe("ok");
  });

  it("renders two identical rows without a duplicate-key warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const row = { text: "Payout failed", meta: "today" };
    render(<ListCard rows={[row, row]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    render(
      <ListCard
        rows={[
          { ...row, key: "a" },
          { ...row, key: "b" },
        ]}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("renders the empty state for no rows", () => {
    render(<ListCard rows={[]} emptyState="No data yet" />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });
});

describe("StatGroupCard", () => {
  it("links a stat that carries an href", () => {
    render(
      <StatGroupCard stats={[{ label: "Errors", value: 2, tone: "err", href: "/admin/runs" }]} />,
    );
    expect(screen.getByRole("link", { name: "2" }).getAttribute("href")).toBe("/admin/runs");
  });
});

describe("cards with repeated labels", () => {
  it("key kv and stat group items by position", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <KvCard
        items={[
          { label: "Owner", value: "Ann" },
          { label: "Owner", value: "Bob" },
        ]}
      />,
    );
    render(
      <StatGroupCard
        stats={[
          { label: "Runs", value: 1 },
          { label: "Runs", value: 2 },
        ]}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
