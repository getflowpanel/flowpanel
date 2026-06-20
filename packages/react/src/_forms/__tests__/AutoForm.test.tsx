// @vitest-environment happy-dom

import type { ColumnMeta } from "@flowpanel/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoForm, buildReferenceSearchUrl } from "../AutoForm.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => cleanup());

const cols: ColumnMeta[] = [
  { name: "id", type: "string", nullable: false, unique: false, primaryKey: true },
  { name: "email", type: "string", nullable: false, unique: false, primaryKey: false },
  { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
  { name: "active", type: "boolean", nullable: false, unique: false, primaryKey: false },
];

describe("AutoForm", () => {
  it("renders a field per non-PK column", () => {
    render(<AutoForm action="/api/x" columns={cols} />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/age/i)).toBeTruthy();
    expect(screen.getByLabelText(/active/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^id$/i)).toBeNull(); // PK hidden
  });

  it("hides explicitly hidden fields", () => {
    render(<AutoForm action="/api/x" columns={cols} hide={["age", "active"]} />);
    expect(screen.queryByLabelText(/age/i)).toBeNull();
    expect(screen.queryByLabelText(/active/i)).toBeNull();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it("uses humanized labels", () => {
    render(
      <AutoForm
        action="/api/x"
        columns={[
          { name: "firstName", type: "string", nullable: false, unique: false, primaryKey: false },
        ]}
      />,
    );
    expect(screen.getByLabelText("First name")).toBeTruthy();
  });

  it("lays fields out on the 12-col grid honoring `span` (default full width)", () => {
    render(
      <AutoForm
        action="/api/x"
        fields={[
          { name: "sku", label: "SKU", type: "text", span: 6 },
          { name: "title", label: "Title", type: "text" },
        ]}
      />,
    );
    const sku = screen.getByLabelText("SKU");
    const title = screen.getByLabelText("Title");
    // Each field sits in a grid cell carrying its span class; an unset span
    // falls back to full width.
    expect(sku.closest('[class*="col-span-6"]')).toBeTruthy();
    expect(title.closest('[class*="col-span-12"]')).toBeTruthy();
  });

  it("renders consecutive fields under their `group` section heading", () => {
    render(
      <AutoForm
        action="/api/x"
        fields={[
          { name: "sku", label: "SKU", type: "text", group: "Identity" },
          { name: "price", label: "Price", type: "number", group: "Pricing" },
          { name: "owner", label: "Owner", type: "text", group: "Pricing" },
        ]}
      />,
    );
    // Both section headings render...
    expect(screen.getByText("Identity")).toBeTruthy();
    expect(screen.getByText("Pricing")).toBeTruthy();
    // ...and the grouped fields are still present.
    expect(screen.getByLabelText("SKU")).toBeTruthy();
    expect(screen.getByLabelText("Owner")).toBeTruthy();
  });

  it("keys repeated non-adjacent groups by position (no duplicate React keys)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <AutoForm
          action="/api/x"
          fields={[
            { name: "a", label: "A", type: "text", group: "G" },
            { name: "b", label: "B", type: "text" },
            { name: "c", label: "C", type: "text", group: "G" },
          ]}
        />,
      );
      // Documented semantics: only *consecutive* fields merge, so a group
      // split by an ungrouped field renders as two separate G sections...
      expect(screen.getAllByText("G")).toHaveLength(2);
      // ...without React's duplicate sibling key warning.
      const dupKeyWarnings = errSpy.mock.calls.filter((args) =>
        args.some((a) => typeof a === "string" && a.includes("same key")),
      );
      expect(dupKeyWarnings).toHaveLength(0);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("renders readOnly text fields with the readonly attribute", () => {
    render(
      <AutoForm
        action="/api/x"
        fields={[{ name: "sku", label: "SKU", type: "text", readOnly: true }]}
      />,
    );
    const input = screen.getByLabelText("SKU") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it("disables readOnly selects and mirrors the value in a hidden input", () => {
    const { container } = render(
      <AutoForm
        action="/api/x"
        fields={[
          {
            name: "status",
            label: "Status",
            type: "select",
            readOnly: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Archived", value: "archived" },
            ],
          },
        ]}
        defaultValues={{ status: "active" }}
      />,
    );
    const select = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    // Disabled selects don't submit — a hidden mirror keeps the value in FormData.
    const mirror = container.querySelector<HTMLInputElement>('input[type="hidden"][name="status"]');
    expect(mirror).toBeTruthy();
    expect(mirror?.value).toBe("active");
  });

  it("prefills create forms from field.defaultValue", () => {
    render(
      <AutoForm
        action="/api/x"
        fields={[{ name: "qty", label: "Qty", type: "number", defaultValue: 5 }]}
      />,
    );
    expect((screen.getByLabelText("Qty") as HTMLInputElement).value).toBe("5");
  });

  it("lets an existing row value win over field.defaultValue on edit", () => {
    render(
      <AutoForm
        action="/api/x"
        fields={[{ name: "qty", label: "Qty", type: "number", defaultValue: 5 }]}
        defaultValues={{ qty: 9 }}
      />,
    );
    expect((screen.getByLabelText("Qty") as HTMLInputElement).value).toBe("9");
  });

  it("sets type=number for numeric columns", () => {
    render(
      <AutoForm
        action="/api/x"
        columns={[
          { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
        ]}
      />,
    );
    const input = screen.getByLabelText(/age/i) as HTMLInputElement;
    expect(input.type).toBe("number");
  });
});

describe("buildReferenceSearchUrl", () => {
  it("derives the resource-scoped search endpoint from a create action", () => {
    expect(buildReferenceSearchUrl("/api/flowpanel/orders/create", "ownerId")).toBe(
      "/api/flowpanel/orders/reference/ownerId",
    );
  });

  it("derives the resource-scoped search endpoint from an edit action", () => {
    expect(buildReferenceSearchUrl("/api/flowpanel/orders/42/edit", "ownerId")).toBe(
      "/api/flowpanel/orders/reference/ownerId",
    );
  });

  it("returns undefined for an action that doesn't follow the FlowPanel convention", () => {
    expect(buildReferenceSearchUrl("/api/x", "ownerId")).toBeUndefined();
  });
});

describe("AutoForm — reference fields", () => {
  it("wires the field's search endpoint from the form's own action, not a static option list", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, options: [{ label: "Alex Admin", value: "u1" }] }),
    });
    render(
      <AutoForm
        action="/api/flowpanel/orders/create"
        fields={[{ name: "ownerId", label: "Owner", type: "reference", options: [] }]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Alex Admin");
    const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
    expect(calledUrl).toMatch(/^\/api\/flowpanel\/orders\/reference\/ownerId\?q=/);
  });
});
