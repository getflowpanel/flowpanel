// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DateRangePicker } from "../../_data/DateRangePicker";
import { DateRangeFilter } from "../../_data/filters/DateRangeFilter";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { AdminShell } from "../AdminShell";

afterEach(cleanup);

it("localizes navigation and retains the specific parent on a detail route", () => {
  render(
    <LabelsProvider
      value={{
        navigation: {
          skipToContent: "К содержимому",
          admin: "Админка",
          open: "Открыть меню",
          title: "Навигация",
          accountMenu: "Меню аккаунта",
        },
      }}
    >
      <AdminShell
        currentPath="/ops/user/42"
        navGroups={[
          {
            items: [
              { label: "Обзор", href: "/ops" },
              { label: "Пользователи", href: "/ops/user" },
              { label: "Профили", href: "/ops/user_profile" },
            ],
          },
        ]}
        user={{ name: "Анна" }}
      >
        <h1>Пользователь</h1>
      </AdminShell>
    </LabelsProvider>,
  );
  expect(screen.getByRole("link", { name: "К содержимому" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Админка" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Пользователи" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(screen.getByRole("link", { name: "Обзор" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Профили" }).getAttribute("aria-current")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));
  expect(screen.getByRole("dialog", { name: "Навигация" })).toBeTruthy();
});

it("translates preset text while preserving its URL key", () => {
  const onChange = vi.fn();
  render(
    <LabelsProvider value={{ dateRange: { last7d: "За 7 дней", today: "Сегодня" } }}>
      <DateRangePicker value={{ preset: "last7d" }} onChange={onChange} />
    </LabelsProvider>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "За 7 дней" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: "Сегодня" }));
  expect(onChange).toHaveBeenCalledWith({ preset: "today" });
});

it("uses an explicit calendar locale for server and client, with unchanged date values", () => {
  const onChange = vi.fn();
  const element = (
    <LabelsProvider
      value={{ dateRange: { locale: "ru-RU", label: "Период", clear: "Сбросить период" } }}
    >
      <DateRangeFilter value="2026-08-05:2026-08-20" onChange={onChange} />
    </LabelsProvider>
  );
  const html = renderToString(element);
  expect(html).toContain("авг.");
  render(element);
  expect(screen.getByRole("button", { name: "Период" }).textContent).toContain("авг.");
  fireEvent.click(screen.getByRole("button", { name: "Сбросить период" }));
  expect(onChange).toHaveBeenCalledWith(null);
});
