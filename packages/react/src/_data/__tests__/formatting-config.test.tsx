// @vitest-environment happy-dom

import { resolveFormatting } from "@flowpanel/core/format";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));

import { FormattingProvider } from "../../_provider/FormattingContext";
import { DataTable } from "../DataTable";

afterEach(cleanup);

const rows = [{ id: "1", total: 1774.5, at: "2026-05-29T12:34:56.000Z" }];

function table(formatting?: Parameters<typeof resolveFormatting>[0]) {
  return render(
    <FormattingProvider value={resolveFormatting(formatting)}>
      <DataTable
        columns={[{ field: "total", format: "number" }, { field: "at" }]}
        rows={rows}
        rowKey="id"
        total={1}
        page={1}
        pageSize={10}
      />
    </FormattingProvider>,
  );
}

describe("configured formatting", () => {
  it("groups numbers the way the configured locale does", () => {
    table();
    expect(screen.getByRole("cell", { name: "1,774.5" })).toBeTruthy();
    cleanup();
    table({ locale: "ru-RU" });
    expect(screen.getByRole("cell", { name: /1\s?774,5/ })).toBeTruthy();
  });

  it("renders money in the configured currency and locale", () => {
    render(
      <FormattingProvider value={resolveFormatting({ locale: "ru-RU", currency: "RUB" })}>
        <DataTable
          columns={[{ field: "total", format: "money" }]}
          rows={rows}
          rowKey="id"
          total={1}
          page={1}
          pageSize={10}
        />
      </FormattingProvider>,
    );
    expect(screen.getByRole("cell", { name: /\u20BD/ })).toBeTruthy();
  });

  it("keeps the sortable date shape when no locale is configured", () => {
    table();
    expect(screen.getByText(/^2026-05-29 \d{2}:\d{2}$/)).toBeTruthy();
  });

  it("lets a configured locale govern dates too", () => {
    table({ locale: "ru-RU" });
    expect(screen.getByText(/29\.05\.2026/)).toBeTruthy();
  });
});
