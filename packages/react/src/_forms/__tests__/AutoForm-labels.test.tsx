// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import type { ColumnMeta } from "@flowpanel/core";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { AsyncSelect } from "../AsyncSelect";
import { AutoForm } from "../AutoForm";

afterEach(cleanup);

const ru = {
  actions: { save: "Сохранить", cancel: "Отмена", create: "Создать" },
  form: {
    selectPlaceholder: "Выберите…",
    noOptions: "Ничего не найдено",
    searching: "Поиск…",
    loadFailed: "Не удалось загрузить варианты",
  },
};

const columns: ColumnMeta[] = [
  { name: "name", type: "string", nullable: true, unique: false, primaryKey: false },
];

describe("generated form chrome", () => {
  it("submits with the configured save label when the caller names none", () => {
    render(
      <LabelsProvider value={ru}>
        <AutoForm action="/api/flowpanel/user/u1/edit" columns={columns} />
      </LabelsProvider>,
    );
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeTruthy();
  });

  it("lets an explicit label win, including an empty one", () => {
    const { rerender } = render(
      <LabelsProvider value={ru}>
        <AutoForm action="/a" columns={columns} submitLabel="Создать" />
      </LabelsProvider>,
    );
    expect(screen.getByRole("button", { name: "Создать" })).toBeTruthy();
    rerender(
      <LabelsProvider value={ru}>
        <AutoForm action="/a" columns={columns} submitLabel="" />
      </LabelsProvider>,
    );
    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
  });

  it("offers a labelled cancel link that navigates instead of submitting", () => {
    const submit = vi.fn();
    render(
      <LabelsProvider value={ru}>
        <div onSubmit={submit}>
          <AutoForm action="/a" columns={columns} cancelHref="/admin/user/u1" />
        </div>
      </LabelsProvider>,
    );
    const cancel = screen.getByRole("link", { name: "Отмена" });
    expect(cancel.getAttribute("href")).toBe("/admin/user/u1");
    fireEvent.click(cancel);
    expect(submit).not.toHaveBeenCalled();
  });

  it("renders no cancel link when the page did not ask for one", () => {
    render(
      <LabelsProvider value={ru}>
        <AutoForm action="/a" columns={columns} />
      </LabelsProvider>,
    );
    expect(screen.queryByRole("link", { name: "Отмена" })).toBeNull();
  });
});

describe("reference select strings", () => {
  const loadOptions = vi.fn(async () => []);

  it("uses the configured placeholder and empty state", async () => {
    render(
      <LabelsProvider value={ru}>
        <AsyncSelect value={null} onChange={vi.fn()} loadOptions={loadOptions} />
      </LabelsProvider>,
    );
    fireEvent.click(screen.getByText("Выберите…"));
    expect(await screen.findByText("Ничего не найдено")).toBeTruthy();
  });

  it("reports a failed search with the configured message and keeps the choice", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    render(
      <LabelsProvider value={ru}>
        <AsyncSelect value="u1" initialLabel="Алиса" onChange={vi.fn()} loadOptions={failing} />
      </LabelsProvider>,
    );
    fireEvent.click(screen.getByText("Алиса"));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Не удалось загрузить варианты",
    );
    expect(screen.getByText("Алиса")).toBeTruthy();
  });

  it("keeps an explicit placeholder the caller passed", () => {
    render(
      <LabelsProvider value={ru}>
        <AsyncSelect
          value={null}
          onChange={vi.fn()}
          loadOptions={loadOptions}
          placeholder="Кого назначить?"
        />
      </LabelsProvider>,
    );
    expect(screen.getByText("Кого назначить?")).toBeTruthy();
  });
});
