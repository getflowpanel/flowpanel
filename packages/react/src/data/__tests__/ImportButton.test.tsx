// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const toastApi = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("../../feedback/toast-api", () => ({
  useToast: () => toastApi,
}));

import { ImportButton } from "../ImportButton";
import { failedRowsCsv, readImportFile } from "../import-file";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function pickFile(container: HTMLElement, name: string, content = "a,b\n1,2") {
  const input = container.querySelector("input[type='file']");
  if (!input) throw new Error("file input not rendered");
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
}

describe("ImportButton", () => {
  it("restricts the file input's accept to the allowed formats", () => {
    const { container } = render(
      <ImportButton resource="users" formats={["json"]} label="Import" />,
    );
    const input = container.querySelector("input[type='file']");
    expect(input?.getAttribute("accept")).toBe(".json");
  });

  it("rejects a file outside the allowed formats without a request", async () => {
    const { container } = render(
      <ImportButton resource="users" formats={["json"]} label="Import" />,
    );
    pickFile(container, "rows.csv");
    await waitFor(() =>
      expect(toastApi.error).toHaveBeenCalledWith("This file type can't be imported. Use .json."),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an extension matching no format even when both are allowed", async () => {
    const { container } = render(
      <ImportButton resource="users" formats={["csv", "json"]} label="Import" />,
    );
    pickFile(container, "rows.txt");
    await waitFor(() =>
      expect(toastApi.error).toHaveBeenCalledWith(
        "This file type can't be imported. Use .csv, .json.",
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says how many rows the file holds and imports only after the confirm", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, imported: 2, failed: [] }),
    });
    const { container } = render(
      <ImportButton resource="users" formats={["csv", "json"]} label="Import" />,
    );
    pickFile(container, "rows.JSON", '[{"a":1},{"a":2}]');
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Import rows.JSON?");
    expect(dialog.textContent).toContain("2 rows will be imported.");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(toastApi.success).toHaveBeenCalledWith("2 rows imported"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flowpanel/users/import",
      expect.objectContaining({
        body: JSON.stringify({ format: "json", content: '[{"a":1},{"a":2}]' }),
      }),
    );
  });

  it("refuses an empty file before asking", async () => {
    const { container } = render(
      <ImportButton resource="users" formats={["csv"]} label="Import" />,
    );
    pickFile(container, "rows.csv", "email,plan\n");
    await waitFor(() =>
      expect(toastApi.error).toHaveBeenCalledWith("This file has no rows to import."),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("lists each refused row with its reason and offers them back as CSV", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        imported: 1,
        failed: [
          { row: 2, error: "email: Enter a valid email" },
          { row: 3, error: "plan: Invalid option" },
        ],
      }),
    });
    const { container } = render(
      <ImportButton resource="users" formats={["csv"]} label="Import" />,
    );
    pickFile(
      container,
      "customers.csv",
      "email,plan\nann@x.test,pro\nnot-an-email,pro\nbob@x.test,platinum\n",
    );
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    const result = await screen.findByRole("dialog");
    expect(result.textContent).toContain("1 row imported. 2 rows were not imported.");
    expect(result.textContent).toContain("Row 2");
    expect(result.textContent).toContain("email: Enter a valid email");
    expect(result.textContent).toContain("plan: Invalid option");
    expect(screen.getByRole("button", { name: "Download failed rows (CSV)" })).toBeTruthy();
  });
});

describe("ImportButton with many refused rows", () => {
  it("lists the first hundred and points at the CSV for the rest", async () => {
    const failed = Array.from({ length: 105 }, (_, i) => ({
      row: i + 1,
      error: "plan: Invalid option",
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, imported: 0, failed }),
    });
    const rows = Array.from({ length: 105 }, (_, i) => `x${i}@x.test,platinum`).join("\n");
    const { container } = render(
      <ImportButton resource="users" formats={["csv"]} label="Import" />,
    );
    pickFile(container, "big.csv", `email,plan\n${rows}\n`);
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    const result = await screen.findByRole("dialog");
    expect(result.querySelectorAll("li")).toHaveLength(100);
    expect(result.textContent).toContain("5 more rows are in the CSV.");
  });
});

describe("failedRowsCsv", () => {
  it("writes the refused rows back with the reason in a last column", () => {
    const file = readImportFile("c.csv", "csv", "email,plan\nann@x.test,pro\nnot-an-email,pro\n");
    if (!file) throw new Error("unreadable");
    expect(failedRowsCsv(file, [{ row: 2, error: "email: Enter a valid email" }], "error")).toBe(
      "email,plan,error\r\nnot-an-email,pro,email: Enter a valid email",
    );
  });
});
