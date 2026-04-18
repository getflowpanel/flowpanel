import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FlowPanelContext } from "../context";
import { LocaleProvider } from "../locale/LocaleContext";
import type { RunLogColumn } from "../components/RunTable";
import { RunTable } from "../components/RunTable";

function TestWrap({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <FlowPanelContext.Provider value={{ timezone: "UTC" }}>{children}</FlowPanelContext.Provider>
    </LocaleProvider>
  );
}

const columns: RunLogColumn[] = [
  { field: "id", label: "Run ID", width: 90, mono: true },
  { field: "status", label: "Status", width: 110, render: "statusTag" },
];

const stageColors: Record<string, string> = {};

describe("RunTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders empty state when no runs", () => {
    render(
      <TestWrap>
        <RunTable runs={[]} columns={columns} stageColors={stageColors} />
      </TestWrap>,
    );
    expect(screen.getByText(/no pipeline runs yet/i)).toBeInTheDocument();
  });

  it("filters runs by status chip — failed-only hides succeeded rows", () => {
    const runs = [
      { id: "1", status: "succeeded" },
      { id: "2", status: "failed" },
      { id: "3", status: "running" },
    ];

    render(
      <TestWrap>
        <RunTable runs={runs} columns={columns} stageColors={stageColors} />
      </TestWrap>,
    );

    // All 3 visible initially
    expect(screen.getAllByRole("row")).toHaveLength(4); // 3 rows + 1 header

    // Click "Failed" chip (button role distinguishes it from status cells)
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    // Only the failed row remains (plus header)
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("navigates rows with j/k keys", () => {
    const runs = [
      { id: "1", status: "succeeded" },
      { id: "2", status: "failed" },
      { id: "3", status: "running" },
    ];

    render(
      <TestWrap>
        <RunTable runs={runs} columns={columns} stageColors={stageColors} />
      </TestWrap>,
    );
    const table = screen.getByRole("table");

    fireEvent.keyDown(table, { key: "j" });
    const rows = screen.getAllByRole("row");
    // Header row + 3 data rows. Index 0 is default, j moves to index 1 (second data row).
    expect(rows[2]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(table, { key: "k" });
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });
});
