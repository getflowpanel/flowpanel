import { textWidthEm } from "@flowpanel/core/format";
import { describe, expect, it } from "vitest";
import { layoutColumns, pinnedPx } from "../column-sizing";
import type { DataTableColumn } from "../data-table-types";

type Row = Record<string, unknown>;
const col = (field: string, extra: Partial<DataTableColumn<Row>> = {}): DataTableColumn<Row> => ({
  field,
  sortable: true,
  ...extra,
});
const badge = (...labels: string[]) => ({
  format: {
    kind: "badge" as const,
    labels: Object.fromEntries(labels.map((label) => [label.toLowerCase(), label])),
  },
});
const money = { format: { kind: "money" as const, minorUnits: 2 } };
const number = (textRem: number, extra: Partial<DataTableColumn<Row>> = {}) => ({
  type: "number" as const,
  textRem,
  ...extra,
});
const date = (label: string) => ({ label, type: "date" as const, textRem: 7.5 });

/** Resolves a width the way the browser does, for a scroller `frame` px wide. */
function px(css: string, frame: number): number {
  const expression = css
    .replace(/(\d*\.?\d+)cqw/g, (_, n: string) => `(${n}*${frame / 100})`)
    .replace(/(\d*\.?\d+)rem/g, (_, n: string) => `(${n}*16)`)
    .replace(/(\d*\.?\d+)px/g, "($1)")
    .replace(/calc\(/g, "(");
  const clamp = (low: number, value: number, high: number) => Math.min(Math.max(low, value), high);
  return new Function("clamp", "max", `return ${expression};`)(clamp, Math.max);
}

function at(
  columns: DataTableColumn<Row>[],
  frame: number,
  options: Parameters<typeof layoutColumns>[1] = {},
): Record<string, number> {
  const { widths } = layoutColumns(columns, options);
  return Object.fromEntries([...widths].map(([field, css]) => [field, px(css, frame)]));
}

const sum = (widths: Record<string, number>) => Object.values(widths).reduce((a, b) => a + b, 0);
const minPx = (columns: DataTableColumn<Row>[], extrasRem: number) =>
  Number.parseFloat(layoutColumns(columns, { extrasRem }).minWidth) * 16;
/** A text column's least width: its whole widest value, or 13rem when that is wider. */
const READABLE_PX = 13 * 16;
const readablePx = (column: DataTableColumn<Row>) =>
  Math.min(READABLE_PX, ((column.textRem ?? 0) + (column.editable ? 4 : 2.5)) * 16);
const SELECTION = { extrasRem: 3 };

/** Header labels in px, measured in the admin's 12 px system-ui type. */
const LABEL_PX: Record<string, number> = {
  ID: 12,
  Email: 30.3,
  Name: 32.9,
  Company: 53.4,
  Plan: 24.3,
  Status: 36.3,
  MRR: 26.2,
  Churned: 48.6,
  "Created at": 59.4,
  "Last seen at": 68.8,
  "Электронная почта": 114.1,
  Имя: 24.5,
  Компания: 58.4,
  Тариф: 37.2,
  Статус: 40.5,
  Отток: 34.9,
  Создан: 43.5,
  "Последний визит": 102.7,
  "E-Mail": 36,
  Unternehmen: 76.9,
  Tarif: 24.9,
  Abgewandert: 75.7,
  "Erstellt am": 59.9,
  "Zuletzt gesehen": 91.7,
  Contact: 44.9,
  Joined: 37.8,
  Product: 44.7,
  Marketplace: 69.7,
  Price: 28.8,
  Stock: 32.3,
  Rating: 36.1,
  Reviews: 46.2,
  Found: 35.4,
  SKU: 24.4,
  Brand: 33.5,
  Category: 51.9,
  "Our price": 52.7,
  Customer: 55.1,
  Provider: 47.2,
  Model: 34.9,
  Task: 25.8,
  "Tokens in": 53.3,
  "Tokens out": 61.8,
  Cost: 26.3,
  Created: 45,
  "Catalog product": 91.4,
  Listing: 37.7,
  Confidence: 64.8,
  Matched: 49.4,
};

/** The demo's list columns, with the widths in rem the server measured on its first page. */
const demo = {
  customers: [
    col("company", { label: "Company", type: "string", editable: true, textRem: 7.25 }),
    col("name", { label: "Contact", type: "string", textRem: 7.25 }),
    col("email", { label: "Email", content: "email", textRem: 13.25 }),
    col("plan", { label: "Plan", ...badge("Free", "Starter", "Pro", "Business") }),
    col("status", { label: "Status", ...badge("Active", "Trialing", "Past due", "Canceled") }),
    col("createdAt", date("Joined")),
  ],
  listings: [
    col("title", { label: "Product", content: "long", textRem: 24 }),
    col("site", { label: "Marketplace", ...badge("Amazon", "eBay", "Walmart", "AliExpress") }),
    col("priceCents", { label: "Price", ...money, textRem: 3.5 }),
    col("stock", { label: "Stock", ...badge("In stock", "Low stock", "Out of stock") }),
    col("rating", number(3, { label: "Rating" })),
    col("reviews", { label: "Reviews", format: "number", textRem: 2.5 }),
    col("scrapedAt", date("Found")),
  ],
  products: [
    col("sku", { label: "SKU", type: "string", textRem: 9.5 }),
    col("title", { label: "Product", content: "long", textRem: 17.75 }),
    col("brand", { label: "Brand", type: "string", textRem: 6.25 }),
    col("category", { label: "Category", type: "string", textRem: 7.75 }),
    col("ourPriceCents", { label: "Our price", ...money, textRem: 4.25 }),
    col("customerId", { label: "Customer", type: "reference", textRem: 7.25 }),
  ],
  ai_usage: [
    col("customerId", { label: "Customer", type: "reference", textRem: 7 }),
    col("provider", { label: "Provider", ...badge("OpenAI", "Anthropic", "Google") }),
    col("model", { label: "Model", type: "string", textRem: 7 }),
    col("task", { label: "Task", ...badge("Match", "Extract") }),
    col("tokensIn", { label: "Tokens in", format: "number", textRem: 2.5 }),
    col("tokensOut", { label: "Tokens out", format: "number", textRem: 2.5 }),
    col("costCents", { label: "Cost", ...money, textRem: 2.5 }),
    col("createdAt", date("Created")),
  ],
  matches: [
    col("productId", { label: "Catalog product", type: "reference", textRem: 17.75 }),
    col("listingId", { label: "Listing", type: "reference", textRem: 22.5 }),
    col("confidence", number(3, { label: "Confidence" })),
    col("status", { label: "Status", ...badge("Confirmed", "Needs review", "Rejected") }),
    col("model", { label: "Model", type: "string", textRem: 7 }),
    col("matchedAt", date("Matched")),
  ],
};

/** The server's estimate of a value's width, as `prerender-cells` makes it. */
const shown = (...values: string[]) =>
  Math.min(
    24,
    Math.ceil(Math.max(...values.map((value) => (textWidthEm(value) * 14) / 16)) * 4) / 4,
  );

const plan = badge("Free", "Starter", "Pro", "Business");
const status = badge("Active", "Trialing", "Past due", "Canceled");

/** The tutorial's customers list: ten columns, seven of them a fixed shape. */
function tutorial(
  labels: string[],
  values: { email: string[]; name: string[]; company: string[]; mrr: string[] },
  badges = { plan, status },
): DataTableColumn<Row>[] {
  const [id, email, name, company, planLabel, statusLabel, mrr, churned, created, seen] = labels;
  return [
    col("id", number(shown("20"), { label: id ?? "" })),
    col("email", { label: email ?? "", content: "email", textRem: shown(...values.email) }),
    col("name", { label: name ?? "", type: "string", textRem: shown(...values.name) }),
    col("company", { label: company ?? "", type: "string", textRem: shown(...values.company) }),
    col("plan", { label: planLabel ?? "", ...badges.plan }),
    col("status", { label: statusLabel ?? "", ...badges.status }),
    col("mrr", number(shown(...values.mrr), { label: mrr ?? "" })),
    col("churned", { label: churned ?? "", type: "boolean", textRem: shown("✓") }),
    col("createdAt", { label: created ?? "", type: "date", textRem: shown("2026-10-05 09:05") }),
    col("lastSeenAt", { label: seen ?? "", type: "date", textRem: shown("2026-10-05 09:05") }),
  ];
}

const ENGLISH = [
  "ID",
  "Email",
  "Name",
  "Company",
  "Plan",
  "Status",
  "MRR",
  "Churned",
  "Created at",
  "Last seen at",
];
const RUSSIAN = [
  "ID",
  "Электронная почта",
  "Имя",
  "Компания",
  "Тариф",
  "Статус",
  "MRR",
  "Отток",
  "Создан",
  "Последний визит",
];
const GERMAN = [
  "ID",
  "E-Mail",
  "Name",
  "Unternehmen",
  "Tarif",
  "Status",
  "MRR",
  "Abgewandert",
  "Erstellt am",
  "Zuletzt gesehen",
];

const seed = {
  email: ["ada@acme.test", "bo@globex.test"],
  name: ["Ada", "Bo"],
  company: ["Acme"],
  mrr: ["0"],
};
/** Twenty customers as a real admin holds them: long names, companies and emails, five-digit MRR. */
const realistic = {
  email: [
    "alexandra.montgomery@northwind-audio.com",
    "j.oconnor@harborgaming.io",
    "priya.raman@summit-logistics.co.uk",
  ],
  name: ["Alexandra Montgomery-Whitfield", "Jonathan O'Connor", "Priya Raman"],
  company: ["Northwind Audio Distribution", "Harbor Gaming Studios", "Summit Logistics Ltd"],
  mrr: ["12900", "4500", "980"],
};

const tutorialCustomers = tutorial(ENGLISH, seed);

/** The scroller's width at each viewport in either shell, up to a list page's 1600 px cap. */
const FRAMES = {
  tabs: { 1100: 1050, 1440: 1390, 1920: 1598, 2560: 1598 },
  sidebar: { 1100: 794, 1440: 1134, 1920: 1598, 2560: 1598 },
} as const;

const sets: Array<[string, DataTableColumn<Row>[], number]> = [
  ["tutorial customers, seed", tutorialCustomers, 3],
  ["tutorial customers, twenty real rows", tutorial(ENGLISH, realistic), 3],
  ["tutorial customers, Russian headers", tutorial(RUSSIAN, realistic), 3],
  ["tutorial customers, German headers", tutorial(GERMAN, realistic), 3],
  ["demo customers", demo.customers, 3],
  ["demo listings", demo.listings, 3],
  ["demo products", demo.products, 3],
  ["demo ai_usage", demo.ai_usage, 3],
  ["demo matches", demo.matches, 3 + 3.5],
];

const fixedShape = (column: DataTableColumn<Row>) =>
  column.type === "number" ||
  column.type === "date" ||
  column.type === "boolean" ||
  column.format === "number" ||
  (typeof column.format === "object" && column.format.kind === "money");

describe("list columns in the shells they ship in", () => {
  for (const [shell, frames] of Object.entries(FRAMES)) {
    for (const [viewport, frame] of Object.entries(frames)) {
      for (const [name, columns, extrasRem] of sets) {
        it(`${name}, ${shell} shell at ${viewport}`, () => {
          const widths = at(columns, frame, { extrasRem });
          for (const column of columns) {
            const label = LABEL_PX[column.label ?? ""];
            if (label !== undefined)
              expect(widths[column.field]).toBeGreaterThanOrEqual(label + 32);
          }
          const textCut = columns.some(
            (column) =>
              !fixedShape(column) &&
              column.textRem !== undefined &&
              (widths[column.field] ?? 0) < (column.textRem + 2.5) * 16 - 0.5,
          );
          for (const column of columns.filter(fixedShape)) {
            const label = LABEL_PX[column.label ?? ""] ?? (column.label ?? "").length * 7.5;
            const need = Math.max(label + 32, ((column.textRem ?? 0) + 2.5) * 16) + 8;
            if (textCut) expect(widths[column.field]).toBeLessThanOrEqual(need);
          }
          for (const column of columns.filter((c) => !fixedShape(c) && c.textRem !== undefined)) {
            expect(widths[column.field], column.field).toBeGreaterThanOrEqual(
              readablePx(column) - 0.5,
            );
          }
          const table = sum(widths) + extrasRem * 16;
          expect(table).toBeCloseTo(Math.max(frame, minPx(columns, extrasRem)), 0);
        });
      }
    }
  }

  it("fits every list from 1920 px in either shell, and the demo's but matches in the tabs shell at 1100", () => {
    for (const [name, columns, extrasRem] of sets) {
      expect(minPx(columns, extrasRem), name).toBeLessThanOrEqual(FRAMES.sidebar[1920]);
      if (name.startsWith("demo")) {
        expect(minPx(columns, extrasRem), name).toBeLessThanOrEqual(FRAMES.tabs[1440]);
      }
      if (name.startsWith("demo") && name !== "demo matches") {
        expect(minPx(columns, extrasRem), name).toBeLessThanOrEqual(FRAMES.tabs[1100]);
      }
    }
    expect(minPx(tutorialCustomers, 3)).toBeLessThanOrEqual(FRAMES.sidebar[1440]);
  });

  it("sizes an id column by its widest id, not by its kind", () => {
    expect(at(tutorialCustomers, 1134, SELECTION).id).toBeLessThanOrEqual(4 * 16);
    expect(layoutColumns([col("id", number(4.25, { label: "ID" }))]).minWidth).toBe("6.500rem");
  });

  it("shares the width left at every ideal across all columns in proportion", () => {
    const wide = at(tutorialCustomers, 1900, SELECTION);
    const narrow = at(tutorialCustomers, 1500, SELECTION);
    const ratio = (wide.email ?? 0) / (narrow.email ?? 1);
    expect(ratio).toBeGreaterThan(1.2);
    for (const field of ["id", "name", "company", "mrr", "churned", "createdAt", "lastSeenAt"]) {
      expect((wide[field] ?? 0) / (narrow[field] ?? 1), field).toBeCloseTo(ratio, 3);
    }
  });

  it("keeps a short customer name near its amount on a wide invoices list", () => {
    const invoices = [
      col("number", { label: "Number", type: "string", textRem: shown("INV-2026-0042") }),
      col("customerId", {
        label: "Customer",
        type: "reference",
        textRem: shown("Union Audio", "Northwind Audio Co"),
      }),
      col("amountCents", { label: "Amount", ...money, textRem: shown("$1,240.00") }),
      col("status", { label: "Status", ...badge("Paid", "Open", "Overdue", "Void") }),
      col("period", { label: "Period", type: "string", textRem: shown("Oct 2026") }),
      col("createdAt", date("Created")),
    ];
    for (const frame of [FRAMES.tabs[1440], FRAMES.tabs[1920]]) {
      const widths = at(invoices, frame, { extrasRem: 3.5 });
      expect(widths.customerId).toBeLessThan(frame * 0.3);
      expect(widths.customerId).toBeLessThan(2.2 * (widths.amountCents ?? 0));
    }
  });

  it("keeps a whole SKU beside the product name at 1100", () => {
    const widths = at(demo.products, FRAMES.tabs[1100], SELECTION);
    expect(widths.sku).toBeGreaterThanOrEqual((9.5 + 2.5) * 16);
    expect(widths.title).toBeGreaterThan(widths.brand ?? 0);
  });

  it("widens a list's text smoothly with its frame, and scrolls only with every column at its narrowest", () => {
    const columns = tutorial(ENGLISH, realistic);
    const narrowest = minPx(columns, 3);
    expect(narrowest).toBeGreaterThan(FRAMES.sidebar[1440]);
    expect(narrowest).toBeLessThanOrEqual(FRAMES.tabs[1920]);
    const text = ["email", "name", "company"];
    let previous: Record<string, number> = {};
    for (let frame = 700; frame <= 1800; frame += 10) {
      const widths = at(columns, frame, SELECTION);
      expect(sum(widths) + 48).toBeCloseTo(Math.max(frame, narrowest), 0);
      for (const field of text) {
        expect(widths[field]).toBeGreaterThanOrEqual(READABLE_PX - 0.001);
        expect(widths[field]).toBeGreaterThanOrEqual((previous[field] ?? 0) - 0.001);
      }
      previous = widths;
    }
  });
});

describe("column widths by what a column holds", () => {
  it("sizes a badge column by its longest label, and 9rem when the labels are unknown", () => {
    const width = (labels: Record<string, string>) =>
      layoutColumns([
        col("stock", { label: "S", sortable: false, format: { kind: "badge", labels } }),
      ]).minWidth;
    expect(width({ in: "In stock", out: "Out of stock" })).toBe("7.500rem");
    expect(width({ a: "A" })).toBe("6.000rem");
    expect(width({ x: "A very long status label that runs on" })).toBe("11.000rem");
    expect(layoutColumns([col("state", { type: "enum", sortable: false })]).minWidth).toBe(
      "9.000rem",
    );
  });

  it("keeps a dragged width, a set width and a pinned column as they are", () => {
    const options = { overrides: { title: 300 }, pinned: new Set(["brand"]) };
    const { widths } = layoutColumns(
      [...demo.products, col("notes", { width: 200 }), col("tags", { width: "20%" })],
      options,
    );
    expect(widths.get("title")).toBe("300px");
    expect(widths.get("brand")).toBe("8.75rem");
    expect(widths.get("notes")).toBe("12.5rem");
    expect(widths.get("tags")).toBe("20%");
  });

  it("falls back to sizes by kind when the server sent no values", () => {
    const columns = [
      col("name", { sortable: false }),
      col("description", { content: "long", sortable: false }),
      col("website", { content: "link", sortable: false }),
    ];
    const fitted = at(columns, (12 + 20 + 14) * 16);
    expect(fitted.name).toBeCloseTo(12 * 16, 1);
    expect(fitted.description).toBeCloseTo(20 * 16, 1);
    expect(fitted.website).toBeCloseTo(14 * 16, 1);
    const wide = at(columns, 2000);
    expect((wide.description ?? 0) / (wide.name ?? 1)).toBeCloseTo(20 / 12, 3);
  });

  it("keeps long text readable beside a pinned text column", () => {
    const columns = [
      col("name", { type: "string", textRem: 23.5, sortable: false }),
      col("description", { content: "long", textRem: 23.5, sortable: false }),
    ];
    const { minWidth } = layoutColumns(columns, { pinned: new Set(["name"]) });
    expect(px(minWidth, 1e6)).toBe(26 * 16 + READABLE_PX);
  });

  it("gives what is left to numbers and dates when no text column can take it", () => {
    const guessed = at(
      [col("mrr", money), col("arr", money), col("createdAt", { type: "date" })],
      1200,
      { extrasRem: 3 + 3.5 },
    );
    expect(sum(guessed) + 48 + 56).toBeCloseTo(1200, 0);
    const measured = at(
      [col("mrr", { ...money, textRem: 3 }), col("createdAt", date("Created"))],
      800,
    );
    expect(sum(measured)).toBeCloseTo(800, 0);
  });

  it("counts wide script in a label double, so the label is not cut", () => {
    const { minWidth } = layoutColumns([
      col("state", {
        label: "状態",
        sortable: false,
        format: { kind: "badge", labels: { due: "支払い期限切れ" } },
      }),
    ]);
    expect(minWidth).toBe("8.750rem");
  });

  it("lets an unmeasured text column narrow to its kind's guess, so a hand-rendered table does not scroll early", () => {
    const columns = [
      col("name", { sortable: false }),
      col("note", { content: "long", sortable: false }),
      col("email", { content: "email", sortable: false }),
      col("site", { content: "link", sortable: false }),
      col("owner", { type: "reference", sortable: false }),
      col("city", { sortable: false }),
    ];
    const { minWidth } = layoutColumns(columns, SELECTION);
    expect(px(minWidth, 1e6)).toBe((3 + 7 + 10 + 10 + 8 + 9 + 7) * 16);
    const measured = layoutColumns([col("name", { textRem: 20, sortable: false })]);
    expect(px(measured.minWidth, 1e6)).toBe(READABLE_PX);
  });

  it("grows a cut link to its whole value before widening anything else", () => {
    const columns = [
      col("id", number(1, { sortable: false })),
      col("website", { format: "url", textRem: 40 }),
    ];
    expect(at(columns, (3.25 + 20) * 16).website).toBeCloseTo(20 * 16, 1);
    const whole = at(columns, (3.25 + 42.5) * 16);
    expect(whole.id).toBeCloseTo(3.25 * 16, 1);
    expect(whole.website).toBeCloseTo(42.5 * 16, 1);
    const { minWidth } = layoutColumns([col("website", { format: "url", textRem: 40 })]);
    expect(px(minWidth, 1e6)).toBe(READABLE_PX);
  });

  it("draws the sort arrow in the padding, and beside the label once a pin button follows it", () => {
    const flag = { label: "Churned", type: "boolean" as const, textRem: 0.5 };
    const rem = (column: DataTableColumn<Row>, headExtrasRem = 0) =>
      Number.parseFloat(layoutColumns([column], { headExtrasRem }).minWidth);
    const sortable = col("flag", flag);
    const plain = col("flag", { ...flag, sortable: false });
    expect(rem(sortable)).toBe(rem(plain));
    expect(rem(plain, 1.5) - rem(plain)).toBe(1.5);
    expect(rem(sortable, 1.5) - rem(sortable)).toBe(2.5);
  });

  it("offsets the second pinned column by the first one's whole width", () => {
    const columns = [
      col("flag", { label: "A rather long header", type: "boolean", textRem: 0.5 }),
      col("mrr", number(2.5, { label: "MRR" })),
      col("name", { textRem: 6 }),
    ];
    const pinned = new Set(["flag", "mrr"]);
    for (const options of [{ headExtrasRem: 1.5 }, { headExtrasRem: 1.5, raised: { flag: 20 } }]) {
      const { widths } = layoutColumns(columns, { pinned, ...options });
      const first = columns[0] ?? col("none");
      const offset = pinnedPx(first, undefined, {
        headExtrasRem: options.headExtrasRem,
        raisedPx: options.raised?.flag,
      });
      expect(offset).toBe(px(widths.get("flag") ?? "", 1000));
    }
    expect(pinnedPx(columns[0] ?? col("none"), 130)).toBe(130);
  });

  it("raises a column the browser found cut, and only that column", () => {
    const columns = [col("mrr", number(2.5, { label: "MRR" })), col("name", { textRem: 4 })];
    const before = at(columns, 300);
    const after = at(columns, 300, { raised: { mrr: 9 } });
    expect(after.mrr).toBeGreaterThanOrEqual((before.mrr ?? 0) + 9);
    expect(px(layoutColumns(columns, { raised: { mrr: 9 } }).minWidth, 1e6)).toBeGreaterThan(
      px(layoutColumns(columns).minWidth, 1e6),
    );
  });
});
