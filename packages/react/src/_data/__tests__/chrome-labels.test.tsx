// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ComponentsProvider } from "../../_provider/ComponentsContext";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { FilterBar } from "../FilterBar";
import { BooleanFilter } from "../filters/BooleanFilter";
import { MultiSelectFilter } from "../filters/MultiSelectFilter";
import { SelectFilter } from "../filters/SelectFilter";
import { Pagination } from "../Pagination";
import { DefaultPagination } from "../PaginationDefault";

afterEach(cleanup);

it("ignores undefined pagination overrides for standalone and provider renderers", () => {
  const overrides = {};
  Object.assign(overrides, { page: undefined, next: undefined });
  const { unmount } = render(
    <DefaultPagination page={1} pageSize={10} total={20} labels={overrides} />,
  );
  expect(screen.getByRole("button", { name: "Page 2" })).toBeTruthy();
  unmount();
  const slot = vi.fn((props) => <DefaultPagination {...props} />);
  render(
    <LabelsProvider value={{ pagination: { next: "Далее", page: "Страница {n}" } }}>
      <ComponentsProvider value={{ Pagination: slot }}>
        <Pagination page={1} pageSize={10} total={20} labels={overrides} />
      </ComponentsProvider>
    </LabelsProvider>,
  );
  expect(screen.getByRole("button", { name: "Далее" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Страница 2" })).toBeTruthy();
  expect(slot.mock.calls[0]?.[0].labels.page).toBe("Страница {n}");
});

it("keeps select query values and clears to null through the real dropdown", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <LabelsProvider value={{ allOption: "Все" }}>
      <SelectFilter
        value={null}
        onChange={onChange}
        options={[{ label: "Платный", value: "paid" }]}
      />
    </LabelsProvider>,
  );
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: "Платный" }));
  expect(onChange).toHaveBeenLastCalledWith("paid");
  rerender(
    <LabelsProvider value={{ allOption: "Все" }}>
      <SelectFilter
        value="paid"
        onChange={onChange}
        options={[{ label: "Платный", value: "paid" }]}
      />
    </LabelsProvider>,
  );
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: "Все" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("uses configured filter chrome while preserving empty placeholders", () => {
  const onClear = vi.fn();
  render(
    <LabelsProvider value={{ allOption: "Все", filters: { label: "Фильтры", clear: "Сбросить" } }}>
      <FilterBar
        filters={[
          { field: "platform", type: "select", options: [] },
          { field: "q", type: "text", placeholder: "" },
        ]}
        values={{ q: "hello" }}
        onChange={vi.fn()}
        onClear={onClear}
      />
    </LabelsProvider>,
  );
  expect(screen.getByRole("toolbar", { name: "Фильтры" })).toBeTruthy();
  expect(screen.getByRole("combobox").textContent).toContain("Все");
  expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  expect(onClear).toHaveBeenCalledOnce();
});

it("localizes selected counts and boolean values, allowing explicit component overrides", () => {
  const { rerender } = render(
    <LabelsProvider
      value={{ bulkBar: { selected: "Выбрано: {n}" }, filters: { yes: "Да", no: "Нет" } }}
    >
      <MultiSelectFilter
        value="one,two"
        onChange={vi.fn()}
        options={[
          { value: "one", label: "Первый" },
          { value: "two", label: "Второй" },
        ]}
      />
      <BooleanFilter value="true" onChange={vi.fn()} />
    </LabelsProvider>,
  );
  expect(screen.getByRole("button", { name: "Выбрано: 2" })).toBeTruthy();
  expect(screen.getByRole("combobox").textContent).toContain("Да");
  rerender(
    <LabelsProvider value={{ filters: { yes: "Да" } }}>
      <BooleanFilter value="true" onChange={vi.fn()} trueLabel="Включено" />
    </LabelsProvider>,
  );
  expect(screen.getByRole("combobox").textContent).toContain("Включено");
});

it("passes pagination labels through the registry without changing navigation values", () => {
  const onChange = vi.fn();
  const onPageSizeChange = vi.fn();
  const slot = vi.fn((props) => <DefaultPagination {...props} />);
  render(
    <LabelsProvider
      value={{
        pagination: {
          label: "Страницы",
          previous: "Назад",
          next: "Далее",
          page: "Страница {n}",
          rowsPerPage: "Строк на странице",
          pageSize: "{n} строк",
        },
      }}
    >
      <ComponentsProvider value={{ Pagination: slot }}>
        <Pagination
          page={2}
          pageSize={10}
          total={100}
          onChange={onChange}
          pageSizeOptions={[10, 20]}
          onPageSizeChange={onPageSizeChange}
        />
      </ComponentsProvider>
    </LabelsProvider>,
  );
  expect(screen.getByRole("navigation", { name: "Страницы" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  expect(onChange).toHaveBeenLastCalledWith(3);
  fireEvent.click(screen.getByRole("button", { name: "Страница 10" }));
  expect(onChange).toHaveBeenLastCalledWith(10);
  fireEvent.change(screen.getByRole("combobox", { name: "Строк на странице" }), {
    target: { value: "20" },
  });
  expect(onPageSizeChange).toHaveBeenCalledWith(20);
  expect(screen.getByRole("option", { name: "20 строк" })).toBeTruthy();
  expect(slot.mock.calls[0]?.[0].labels.next).toBe("Далее");
});
