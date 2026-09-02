// @vitest-environment happy-dom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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

vi.mock("../../_feedback/toast-api", () => ({
  useToast: () => toastApi,
}));

import { ImportButton } from "../ImportButton";

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

  it("rejects a file outside the allowed formats without a request", () => {
    const { container } = render(
      <ImportButton resource="users" formats={["json"]} label="Import" />,
    );
    pickFile(container, "rows.csv");
    expect(toastApi.error).toHaveBeenCalledWith("Unsupported file type — expected .json");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an extension matching no format even when both are allowed", () => {
    const { container } = render(
      <ImportButton resource="users" formats={["csv", "json"]} label="Import" />,
    );
    pickFile(container, "rows.txt");
    expect(toastApi.error).toHaveBeenCalledWith("Unsupported file type — expected .csv or .json");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("infers the format from the extension among allowed formats", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, imported: 2, failed: [] }),
    });
    const { container } = render(
      <ImportButton resource="users" formats={["csv", "json"]} label="Import" />,
    );
    pickFile(container, "rows.JSON", '[{"a":1},{"a":2}]');
    await waitFor(() => expect(toastApi.success).toHaveBeenCalledWith("Imported 2 rows"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flowpanel/users/import",
      expect.objectContaining({
        body: JSON.stringify({ format: "json", content: '[{"a":1},{"a":2}]' }),
      }),
    );
  });
});
