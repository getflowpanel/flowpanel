// @vitest-environment happy-dom

import { LabelsProvider } from "@flowpanel/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SavedViewsDropdown } from "../SavedViewsDropdown";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/ops/user",
  useSearchParams: () => new URLSearchParams("f_role=admin"),
}));
vi.mock("@flowpanel/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flowpanel/react")>()),
  useToast: () => toast,
}));
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("uses translated accessible copy and preserves the filter in a saved view", () => {
  render(
    <LabelsProvider
      value={{
        actions: { save: "Сохранить" },
        savedViews: {
          save: "Сохранить представление",
          saveTrigger: "Сохранить вид…",
          name: "Название",
          saved: "Сохранено: {name}",
        },
      }}
    >
      <SavedViewsDropdown resource="user" staticViews={[]} />
    </LabelsProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Сохранить вид…" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название" }), {
    target: { value: "Администраторы" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  expect(JSON.parse(window.localStorage.getItem("flowpanel:views:user") ?? "[]")[0]).toEqual({
    name: "Администраторы",
    filters: { role: "admin" },
  });
  expect(toast.success).toHaveBeenCalledWith("Сохранено: Администраторы");
});

it("keeps the form and reports failure when browser storage rejects a save", () => {
  const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  render(
    <LabelsProvider value={{ savedViews: { storageError: "Не удалось сохранить" } }}>
      <SavedViewsDropdown resource="user" staticViews={[]} />
    </LabelsProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save view…" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Admins" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(write).toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith("Не удалось сохранить");
  expect(toast.success).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Save view" })).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Admins");
});
