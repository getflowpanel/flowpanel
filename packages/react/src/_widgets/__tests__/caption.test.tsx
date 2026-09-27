// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin",
}));

import { BarsCard } from "../BarsCard";
import { CaptionLine } from "../CaptionLine";
import { ExpiredCard } from "../ExpiredCard";
import { DefaultMetricCard } from "../MetricCardDefault";
import { StatCard } from "../StatCard";
import { TableWidget } from "../TableWidget";

afterEach(cleanup);

describe("CaptionLine", () => {
  it("prints the caption muted, with its hover title", () => {
    const { container } = render(
      <CaptionLine caption={{ text: "Data as of 2026-09-21 06:00", title: "6 hours ago" }} />,
    );
    const line = container.querySelector("[data-fp-caption]");
    expect(line?.textContent).toBe("Data as of 2026-09-21 06:00");
    expect(line?.getAttribute("title")).toBe("6 hours ago");
    expect(line?.className).toContain("text-fp-text-3");
  });

  it("marks a stale caption with a glyph as well as the warn colour", () => {
    const { container } = render(
      <CaptionLine caption={{ text: "Data as of 06:00", tone: "warn" }} />,
    );
    const line = container.querySelector("[data-fp-caption]");
    expect(line?.textContent).toBe("▲ Warning Data as of 06:00");
    expect(screen.getByText("Warning").className).toContain("sr-only");
    expect(line?.className).toContain("text-fp-warn-text");
  });

  it("marks an error caption with ✕, the error glyph", () => {
    const { container } = render(<CaptionLine caption={{ text: "Feed down", tone: "err" }} />);
    expect(container.querySelector("[data-fp-caption]")?.textContent).toBe("✕ Error Feed down");
  });

  it("renders nothing without a caption", () => {
    const { container } = render(<CaptionLine />);
    expect(container.innerHTML).toBe("");
  });
});

describe("cards with a caption", () => {
  const caption = { text: "consented users only" };

  it("shows it on a card that has no label", () => {
    render(<BarsCard rows={[]} caption={caption} />);
    expect(screen.getByText("consented users only")).toBeTruthy();
  });

  it("shows it under a metric's, a stat's and a table's title", () => {
    render(
      <>
        <DefaultMetricCard label="Visits" value={3} caption={caption} />
        <StatCard label="Orders" value={3} caption={{ text: "since 2026-09-14" }} />
        <TableWidget
          label="Runs"
          rows={[]}
          columns={[]}
          rowKey="id"
          caption={{ text: "sampled" }}
        />
      </>,
    );
    expect(screen.getByText("consented users only")).toBeTruthy();
    expect(screen.getByText("since 2026-09-14")).toBeTruthy();
    expect(screen.getByText("sampled")).toBeTruthy();
  });

  it("shows an expired widget as a dash with its caption", () => {
    render(<ExpiredCard label="Orders" caption={{ text: "No data: kept for 30 days" }} />);
    expect(screen.getByText("Orders")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("No data: kept for 30 days")).toBeTruthy();
  });
});
