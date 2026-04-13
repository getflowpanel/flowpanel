import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunLogColumn } from "../components/RunTable";
import { RunTable } from "../components/RunTable";

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
    render(<RunTable runs={[]} columns={columns} stageColors={stageColors} />);
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
  });

  it("filters runs by status chip", () => {
    const onStatusFilter = vi.fn();
    render(
      <RunTable
        runs={[]}
        columns={columns}
        stageColors={stageColors}
        onStatusFilter={onStatusFilter}
        activeStatusFilter={null}
      />,
    );

    fireEvent.click(screen.getByText("Failed"));
    expect(onStatusFilter).toHaveBeenCalledWith("failed");
  });

  it("navigates rows with j/k keys", () => {
    const runs = [
      { id: "1", status: "succeeded" },
      { id: "2", status: "failed" },
      { id: "3", status: "running" },
    ];

    render(<RunTable runs={runs} columns={columns} stageColors={stageColors} />);
    const table = screen.getByRole("table");

    fireEvent.keyDown(table, { key: "j" });
    const rows = screen.getAllByRole("row");
    // After pressing j, the second data row (index 1) should be selected
    expect(rows[2]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(table, { key: "k" });
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });
});
