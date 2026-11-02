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
vi.mock("../../feedback/toast-api", () => ({ useToast: () => toastApi }));
vi.mock("../ImportDialogs", () => {
  throw new Error("chunk failed to load");
});

import { DEFAULT_LABELS } from "@flowpanel/core/labels";
import { ImportButton } from "../ImportButton";

afterEach(cleanup);

describe("ImportButton when its dialogs cannot load", () => {
  it("says the server could not be reached and leaves the list working", async () => {
    const { container } = render(
      <ImportButton resource="users" formats={["csv"]} label="Import" />,
    );
    const input = container.querySelector("input[type='file']");
    if (!input) throw new Error("no file input");
    fireEvent.change(input, { target: { files: [new File(["a,b\n1,2"], "rows.csv")] } });
    await waitFor(() => expect(toastApi.error).toHaveBeenCalledWith(DEFAULT_LABELS.errors.network));
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
