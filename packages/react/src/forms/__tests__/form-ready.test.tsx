// @vitest-environment happy-dom

import type { ColumnMeta } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoForm } from "../AutoForm";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => cleanup());

const cols: ColumnMeta[] = [
  { name: "email", type: "string", nullable: false, unique: false, primaryKey: false },
  {
    name: "plan",
    type: "enum",
    nullable: false,
    unique: false,
    primaryKey: false,
    enumValues: ["free", "pro"],
  },
  { name: "active", type: "boolean", nullable: false, unique: false, primaryKey: false },
];

describe("a form before its code runs", () => {
  it("renders inert on the server: read-only text, disabled choices and submit, a busy form", () => {
    const html = renderToString(<AutoForm action="/api/x" columns={cols} />);
    const box = document.createElement("div");
    box.innerHTML = html;
    expect(box.querySelector("[data-fp-form-fields]")?.getAttribute("aria-busy")).toBe("true");
    expect(box.querySelector("input[name=email]")?.hasAttribute("readonly")).toBe(true);
    expect(box.querySelector("input[name=email]")?.hasAttribute("aria-readonly")).toBe(false);
    expect(box.querySelector("select")?.hasAttribute("disabled")).toBe(true);
    expect(box.querySelector("button[type=submit]")?.hasAttribute("disabled")).toBe(true);
  });

  it("keeps its fields from focus and says it is loading in a row screen readers still reach", () => {
    const box = document.createElement("div");
    box.innerHTML = renderToString(<AutoForm action="/api/x" columns={cols} />);
    const fields = box.querySelector("[data-fp-form-fields]");
    expect(fields?.hasAttribute("inert")).toBe(true);
    expect(fields?.hasAttribute("data-fp-loading")).toBe(true);
    expect(box.querySelector("form")?.hasAttribute("inert")).toBe(false);
    const actions = box.querySelector("[data-fp-form-actions]");
    expect(actions?.closest("[inert]")).toBeNull();
    expect(actions?.lastElementChild?.getAttribute("role")).toBe("status");
    expect(actions?.lastElementChild?.textContent).toBe("Loading form…");
  });

  it("disables pickers that ignore readonly until it runs, then enables them", () => {
    const fields = [
      { name: "brand", label: "Brand", type: "color" as const },
      { name: "due", label: "Due", type: "date" as const },
    ];
    const box = document.createElement("div");
    box.innerHTML = renderToString(<AutoForm action="/api/x" fields={fields} />);
    expect(box.querySelector("input[name=brand]")?.hasAttribute("disabled")).toBe(true);
    expect(box.querySelector("input[name=due]")?.hasAttribute("disabled")).toBe(true);
    render(<AutoForm action="/api/x" fields={fields} />);
    expect(screen.getByLabelText("Brand").hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText("Due").hasAttribute("disabled")).toBe(false);
  });

  it("takes input as soon as it runs in the browser", () => {
    render(<AutoForm action="/api/x" columns={cols} />);
    expect(screen.getByLabelText(/email/i).hasAttribute("readonly")).toBe(false);
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false);
    const fields = screen
      .getByRole("button", { name: "Save" })
      .closest("form")
      ?.querySelector("[data-fp-form-fields]");
    expect(fields?.hasAttribute("inert")).toBe(false);
    expect(fields?.hasAttribute("data-fp-loading")).toBe(false);
    expect(screen.queryByText("Loading form…")).toBeNull();
  });
});
