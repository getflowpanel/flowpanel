import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const triggerDownload = vi.fn();
vi.mock("../../lib/trigger-download.js", () => ({
  triggerDownload: (...args: unknown[]) => triggerDownload(...args),
}));

import { ExportButton } from "../csv-export.js";
import type { DataTableColumn } from "../data-table-types.js";

afterEach(() => {
  cleanup();
  triggerDownload.mockClear();
});

type Row = { id: string; name: string; age: number };
const columns: DataTableColumn<Row>[] = [
  { field: "name", label: "Name" },
  { field: "age", label: "Age" },
];
const rows: Row[] = [{ id: "1", name: "Alice", age: 30 }];

describe("ExportButton", () => {
  it("a single configured format renders a plain button that downloads immediately", () => {
    render(
      <ExportButton
        columns={columns}
        rows={rows}
        label="Export"
        tableLabel="users"
        formats={["csv"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const call = triggerDownload.mock.calls[0]?.[0] as { mime: string; filename: string };
    expect(call.mime).toBe("text/csv;charset=utf-8");
    expect(call.filename).toBe("users-1-rows.csv");
  });

  it("two configured formats render a dropdown offering CSV and JSON", async () => {
    render(
      <ExportButton
        columns={columns}
        rows={rows}
        label="Export"
        tableLabel="users"
        formats={["csv", "json"]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Export" });
    // Radix DropdownMenu needs keyboard to open reliably in happy-dom.
    fireEvent.keyDown(trigger, { key: "Enter" });
    const jsonItem = await screen.findByRole("menuitem", { name: /export as json/i });
    fireEvent.click(jsonItem);
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const call = triggerDownload.mock.calls[0]?.[0] as {
      mime: string;
      filename: string;
      data: string;
    };
    expect(call.mime).toBe("application/json;charset=utf-8");
    expect(call.filename).toBe("users-1-rows.json");
    expect(JSON.parse(call.data)).toEqual([{ name: "Alice", age: 30 }]);
  });

  it("only exports the columns it's given, regardless of the full row shape", () => {
    // Emulates the caller (DataTable) already restricting columns to the
    // resource's `export.fields` whitelist before rendering this button.
    render(
      <ExportButton
        columns={[{ field: "name", label: "Name" }]}
        rows={rows}
        label="Export"
        tableLabel="users"
        formats={["json"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const call = triggerDownload.mock.calls[0]?.[0] as { data: string };
    expect(JSON.parse(call.data)).toEqual([{ name: "Alice" }]);
  });
});
