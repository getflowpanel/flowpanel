// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

const triggerDownload = vi.fn();
vi.mock("../../lib/trigger-download", () => ({
  triggerDownload: (...args: unknown[]) => triggerDownload(...args),
}));

import { DataTable } from "../DataTable";

afterEach(() => {
  cleanup();
  triggerDownload.mockClear();
});

type Row = { id: string; email: string; name: string; ssn: string };

const rows: Row[] = [{ id: "1", email: "a@b.co", name: "Alice", ssn: "000-00-0000" }];

const columns = [
  { field: "email" as const, label: "Email" },
  { field: "name" as const, label: "Name" },
  { field: "ssn" as const, label: "SSN" },
];

describe("DataTable export config (formats / fields)", () => {
  it("`exportable: true` is CSV-only, all visible columns", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const call = triggerDownload.mock.calls[0]?.[0] as { mime: string; data: string };
    expect(call.mime).toBe("text/csv;charset=utf-8");
    expect(call.data).toContain("SSN");
  });

  it("`exportable.fields` restricts the exported columns", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable={{ fields: ["email", "name"] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const call = triggerDownload.mock.calls[0]?.[0] as { data: string };
    expect(call.data).toContain("Email");
    expect(call.data).toContain("Name");
    expect(call.data).not.toContain("SSN");
  });

  it("`exportable.fields` includes a field that is not a displayed column (e.g. the row key) in CSV output", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable={{ fields: ["id", "email"] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const call = triggerDownload.mock.calls[0]?.[0] as { data: string };
    const [header, ...body] = call.data.split("\r\n");
    // `id` isn't a `columns` entry (only email/name/ssn are), but it's still
    // present on the row — it must appear via the humanized fallback label,
    // not be silently dropped because there's no matching `DataTableColumn`.
    expect(header?.split(",")).toEqual(["ID", "Email"]);
    expect(body[0]).toBe("1,a@b.co");
  });

  it("`exportable.fields` includes a field that is not a displayed column in JSON output", async () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable={{ fields: ["id", "email"], formats: ["csv", "json"] }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Export" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /export as json/i }));
    const call = triggerDownload.mock.calls[0]?.[0] as { data: string };
    expect(JSON.parse(call.data)).toEqual([{ id: "1", email: "a@b.co" }]);
  });

  it("`exportable.formats` with two entries offers a CSV/JSON picker", async () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        total={1}
        page={1}
        pageSize={10}
        rowKey="id"
        exportable={{ formats: ["csv", "json"] }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Export" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: /export as csv/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /export as json/i })).toBeTruthy();
  });
});
