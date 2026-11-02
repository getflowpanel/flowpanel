import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const triggerDownload = vi.fn();
vi.mock("../../lib/trigger-download", () => ({
  triggerDownload: (...args: unknown[]) => triggerDownload(...args),
}));

import { cappedMessage, ExportButton } from "../csv-export";
import type { DataTableColumn } from "../data-table-types";

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
  it("a single configured format renders a plain button that downloads immediately", async () => {
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
    await vi.waitFor(() => expect(triggerDownload).toHaveBeenCalledTimes(1));
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
    await vi.waitFor(() => expect(triggerDownload).toHaveBeenCalledTimes(1));
    const call = triggerDownload.mock.calls[0]?.[0] as {
      mime: string;
      filename: string;
      data: string;
    };
    expect(call.mime).toBe("application/json;charset=utf-8");
    expect(call.filename).toBe("users-1-rows.json");
    expect(JSON.parse(call.data)).toEqual([{ name: "Alice", age: 30 }]);
  });

  it("only exports the columns it's given, regardless of the full row shape", async () => {
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
    await vi.waitFor(() => expect(triggerDownload).toHaveBeenCalled());
    const call = triggerDownload.mock.calls[0]?.[0] as { data: string };
    expect(JSON.parse(call.data)).toEqual([{ name: "Alice" }]);
  });
});

describe("ExportButton with a resource", () => {
  it("asks the server for every matching row with the page's filters and saves its file", async () => {
    window.history.replaceState(null, "", "/admin/users?f_plan=pro&q=al&page=3");
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response("Name\r\nAlice\r\n", {
          headers: {
            "content-disposition": 'attachment; filename="users-filtered-2026-10-09.csv"',
            "x-flowpanel-export-capped": "10000",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ExportButton
        columns={columns}
        rows={rows}
        label="Export"
        tableLabel="users"
        formats={["csv"]}
        resource="users"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await vi.waitFor(() => expect(triggerDownload).toHaveBeenCalledTimes(1));
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/flowpanel/export/users");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      f_plan: "pro",
      q: "al",
      page: "3",
      format: "csv",
    });
    expect(triggerDownload.mock.calls[0]?.[0]).toMatchObject({
      filename: "users-filtered-2026-10-09.csv",
    });
    vi.unstubAllGlobals();
  });
});

describe("the capped-export warning", () => {
  it("writes the row count the way the admin's locale groups numbers", async () => {
    expect(cappedMessage("first {n} rows", "10000", "ru-RU")).toBe("first 10\u00a0000 rows");
    expect(cappedMessage("first {n} rows", "10000", "en-US")).toBe("first 10,000 rows");
  });
});
