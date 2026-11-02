import { createElement as h, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AdminShell,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../react/dist/index.mjs";

export interface FixtureOptions {
  shell: "tabs" | "sidebar";
  rows: number;
  inlineActions: number;
  rowMenu: boolean;
  tabs: string[];
  activeTab: number;
  overlays: boolean;
  footerPx: number;
  headerPx: number;
}

declare global {
  interface Window {
    fixture: FixtureOptions;
  }
}

type Row = Record<string, unknown>;

const NAMES = ["Alexandra Montgomery-Whitfield", "Union Audio", "Northwind", "Acme", "Globex Corp"];

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: NAMES[index % NAMES.length],
    email: `${NAMES[index % NAMES.length]?.toLowerCase().replaceAll(/[^a-z]/g, "")}${index}@gmail.com`,
    active: index % 3 !== 0,
    mrr: (index * 1234) % 9000,
    createdAt: new Date(Date.UTC(2026, 5, 1 + index)).toISOString(),
  }));
}

function actions(count: number, menu: boolean): ReactNode {
  return h(
    "div",
    { role: "toolbar", className: "fp-flex fp-items-center fp-justify-end -fp-my-1.5 fp-gap-1" },
    Array.from({ length: count }, (_, index) =>
      h(
        Button,
        { key: index, size: "sm", variant: "outline" },
        index === 0 ? "Mark churned" : "Send reminder",
      ),
    ),
    menu
      ? h("button", {
          type: "button",
          "aria-label": "Row actions",
          "data-row-menu": "",
          className: "fp-inline-flex fp-h-7 fp-w-7 fp-shrink-0",
        })
      : null,
  );
}

function Filters() {
  const [values, setValues] = useState<Record<string, string>>({});
  return h(FilterBar, {
    filters: [
      {
        field: "plan",
        label: "Plan",
        type: "select",
        options: [
          { label: "Free", value: "free" },
          { label: "Pro", value: "pro" },
        ],
      },
      {
        field: "status",
        label: "Status",
        type: "multiselect",
        options: [
          { label: "Active", value: "active" },
          { label: "Churned", value: "churned" },
        ],
      },
    ],
    values,
    onChange: (field: string, value: string | null) =>
      setValues((current) => {
        const next = { ...current };
        if (value) next[field] = value;
        else delete next[field];
        return next;
      }),
  });
}

/** A popover opened from a button inside a form, as the reference picker does. */
function FormPicker() {
  const [open, setOpen] = useState(false);
  return h(
    "form",
    {
      id: "picker-form",
      onSubmit: (event: Event) => {
        event.preventDefault();
        document.body.dataset.submitted = "true";
      },
    },
    h(
      Popover,
      { open, onOpenChange: setOpen },
      h(PopoverTrigger, { asChild: true }, h(Button, { variant: "outline" }, "Pick a customer")),
      h(PopoverContent, null, h("div", { role: "listbox", "aria-label": "Customers" }, "Acme")),
    ),
  );
}

function bar(px: number, label: string): ReactNode {
  return px > 0 ? h("div", { id: label, style: { height: px, background: "#ddd" } }, label) : null;
}

const options = window.fixture;
const root = document.getElementById("root");
if (!root) throw new Error("fixture root missing");
createRoot(root).render(
  h(
    "div",
    null,
    bar(options.headerPx, "host-header"),
    h(
      "div",
      { "data-flowpanel-root": "" },
      h(
        AdminShell,
        {
          variant: options.shell,
          navGroups: [
            {
              items: options.tabs.map((label) => ({
                label,
                href: `/admin/${label.toLowerCase().replaceAll(" ", "-")}`,
              })),
            },
          ],
          currentPath: `/admin/${(options.tabs[options.activeTab] ?? "").toLowerCase().replaceAll(" ", "-")}`,
          showSkipLink: false,
        },
        h(PageHeader, { title: "Customers" }),
        options.overlays ? h(Filters) : null,
        options.overlays ? h(FormPicker) : null,
        h(DataTable, {
          rowKey: "id",
          rows: rows(options.rows),
          total: options.rows,
          page: 1,
          pageSize: options.rows,
          columns: [
            { field: "name", label: "Name" },
            { field: "email", label: "Email", content: "email" },
            { field: "active", label: "Active", type: "boolean" },
            { field: "mrr", label: "MRR", type: "number", align: "right" },
            { field: "createdAt", label: "Created at", type: "date" },
          ],
          ...(options.overlays ? { onColumnVisibilityChange: () => undefined } : {}),
          ...(options.inlineActions > 0 || options.rowMenu
            ? {
                rowEndCell: () => actions(options.inlineActions, options.rowMenu),
                rowEndCellRem: 9 * options.inlineActions + 2,
              }
            : {}),
        }),
      ),
    ),
    bar(options.footerPx, "host-footer"),
  ),
);
