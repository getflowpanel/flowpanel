import type { ColumnDef, ColumnMeta, RequestContext } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { prerenderResourceCells } from "../runtime/prerender-cells";

type Row = { id: string; email: string; tags: string[]; userId: string; secret: string };

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("prerenderResourceCells", () => {
  it("expands string column entries to PrerenderedColumn with `field` and what the text holds", () => {
    const out = prerenderResourceCells<Row>(
      ["id", "email"],
      [{ id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" }],
      reqCtx,
    );
    expect(out.columns).toEqual([
      { field: "id", textRem: expect.any(Number) },
      { field: "email", content: "email", textRem: expect.any(Number) },
    ]);
    // No renderer declared — prerenderedCells stays undefined.
    expect(out.prerenderedCells).toBeUndefined();
  });

  it("applies defaultSortable to string entries", () => {
    const out = prerenderResourceCells<Row>(["id"], [], reqCtx, { defaultSortable: true });
    expect(out.columns[0]).toMatchObject({ field: "id", sortable: true });
  });

  it("forwards ColumnMeta.type via metaByField for string entries", () => {
    const meta = new Map<string, ColumnMeta>([
      ["tags", { name: "tags", type: "array", nullable: false, unique: false, primaryKey: false }],
    ]);
    const out = prerenderResourceCells<Row>(["tags"], [], reqCtx, { metaByField: meta });
    expect(out.columns[0]).toMatchObject({ field: "tags", type: "array" });
  });

  it("respects ColumnDef sortable override", () => {
    const out = prerenderResourceCells<Row>(
      [{ field: "id", sortable: false } as ColumnDef<Row>],
      [],
      reqCtx,
      { defaultSortable: true },
    );
    expect(out.columns[0]?.sortable).toBe(false);
  });

  it("drops hidden columns when dropHidden=true", () => {
    const out = prerenderResourceCells<Row>(
      [{ field: "id" } as ColumnDef<Row>, { field: "secret", hidden: true } as ColumnDef<Row>],
      [],
      reqCtx,
      { dropHidden: true },
    );
    expect(out.columns).toHaveLength(1);
    expect(out.columns[0]?.field).toBe("id");
  });

  it("keeps hidden columns and propagates the flag when dropHidden=false", () => {
    const out = prerenderResourceCells<Row>(
      [{ field: "secret", hidden: true } as ColumnDef<Row>],
      [],
      reqCtx,
    );
    expect(out.columns).toHaveLength(1);
    expect(out.columns[0]?.hidden).toBe(true);
  });

  it("gives a field-less render column a synthetic key and prerenders its cell", () => {
    const out = prerenderResourceCells<Row>(
      [
        { field: "id" } as ColumnDef<Row>,
        {
          label: "Actions",
          render: (row) => `edit:${row.id}`,
        } as ColumnDef<Row>,
      ],
      [{ id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" }],
      reqCtx,
      { defaultSortable: true },
    );
    expect(out.columns).toHaveLength(2);
    expect(out.columns[1]).toEqual({
      field: "__cell_1",
      label: "Actions",
      sortable: false,
      textRem: expect.any(Number),
    });
    expect(out.prerenderedCells?.[0]?.[1]).toBe("edit:1");
  });

  it("keys a field-less column by its position in the declared list, not the emitted one", () => {
    const out = prerenderResourceCells<Row>(
      [
        { field: "secret", hidden: true } as ColumnDef<Row>,
        { label: "Actions", render: () => "x" } as ColumnDef<Row>,
      ],
      [{ id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" }],
      reqCtx,
      { dropHidden: true },
    );
    expect(out.columns).toHaveLength(1);
    expect(out.columns[0]?.field).toBe("__cell_1");
  });

  it("never offers a field-less column for sorting", () => {
    const out = prerenderResourceCells<Row>(
      [{ label: "Actions", sortable: true, render: () => "x" } as ColumnDef<Row>],
      [],
      reqCtx,
      { defaultSortable: true },
    );
    expect(out.columns[0]?.sortable).toBe(false);
  });

  it("skips a field-less column with no render, warning in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = prerenderResourceCells<Row>([{ label: "ghost" } as ColumnDef<Row>], [], reqCtx);
    expect(out.columns).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("skips a field-less render column with no label, warning in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = prerenderResourceCells<Row>(
      [{ render: () => "x" } as ColumnDef<Row>],
      [{ id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" }],
      reqCtx,
    );
    expect(out.columns).toHaveLength(0);
    expect(out.prerenderedCells).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("emits type='reference' on columns with a reference, overriding metaByField", () => {
    const meta = new Map<string, ColumnMeta>([
      [
        "userId",
        { name: "userId", type: "array", nullable: false, unique: false, primaryKey: false },
      ],
    ]);
    const out = prerenderResourceCells<Row>(
      [
        {
          field: "userId",
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Row>,
      ],
      [],
      reqCtx,
      { metaByField: meta },
    );
    expect(out.columns[0]?.type).toBe("reference");
  });

  it("falls back to metaByField when ColumnDef has no reference", () => {
    const meta = new Map<string, ColumnMeta>([
      ["tags", { name: "tags", type: "array", nullable: false, unique: false, primaryKey: false }],
    ]);
    const out = prerenderResourceCells<Row>([{ field: "tags" } as ColumnDef<Row>], [], reqCtx, {
      metaByField: meta,
    });
    expect(out.columns[0]?.type).toBe("array");
  });

  it("invokes render(row, reqCtx) and populates prerenderedCells", () => {
    const out = prerenderResourceCells<Row>(
      [
        { field: "email" } as ColumnDef<Row>,
        {
          field: "email",
          render: (row, ctx) => `<${row.email}>:${ctx.role}`,
        } as ColumnDef<Row>,
      ],
      [
        { id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" },
        { id: "2", email: "c@d.com", tags: [], userId: "u2", secret: "" },
      ],
      reqCtx,
    );
    expect(out.prerenderedCells).toHaveLength(2);
    // Row 0: first column has no render (undefined), second column calls render().
    expect(out.prerenderedCells?.[0]?.[0]).toBeUndefined();
    expect(out.prerenderedCells?.[0]?.[1]).toBe("<a@b.com>:admin");
    expect(out.prerenderedCells?.[1]?.[1]).toBe("<c@d.com>:admin");
  });

  it("propagates label/width/align/className/editable from ColumnDef", () => {
    const out = prerenderResourceCells<Row>(
      [
        {
          field: "email",
          label: "Email",
          width: 240,
          align: "right",
          className: "muted",
          editable: true,
        } as ColumnDef<Row>,
      ],
      [],
      reqCtx,
    );
    expect(out.columns[0]).toMatchObject({
      field: "email",
      label: "Email",
      width: 240,
      align: "right",
      className: "muted",
      editable: true,
    });
  });

  it("sends an editable badge column's choices with the labels its badges show", () => {
    const out = prerenderResourceCells<Row>(
      [
        {
          field: "email",
          editable: true,
          format: {
            kind: "badge",
            labels: { new: "Neu", solved: "Gelöst" },
            tones: { open: "info" },
          },
        },
        { field: "secret", format: { kind: "badge", labels: { a: "A" } } },
      ],
      [],
      reqCtx,
    );
    expect(out.columns[0]?.options).toEqual([
      { value: "new", label: "Neu" },
      { value: "solved", label: "Gelöst" },
      { value: "open", label: "Open" },
    ]);
    expect(out.columns[1]?.options).toBeUndefined();
  });

  it("labels an enum column's values as its form's select does", () => {
    const status: ColumnMeta = {
      name: "secret",
      type: "string",
      nullable: false,
      unique: false,
      primaryKey: false,
      enumValues: ["paid", "past_due"],
    };
    const labelled = [
      { value: "paid", label: "Paid" },
      { value: "past_due", label: "Past due" },
    ];
    const metaByField = new Map([["secret", status]]);
    const bare = prerenderResourceCells<Row>(["secret"], [], reqCtx, { metaByField });
    expect(bare.columns[0]?.options).toEqual(labelled);
    const declared = prerenderResourceCells<Row>(
      [{ field: "secret" }, { field: "secret", format: "badge" }],
      [],
      reqCtx,
      { metaByField },
    );
    expect(declared.columns[0]?.options).toEqual(labelled);
    expect(declared.columns[1]?.options).toBeUndefined();
  });

  it("shows a SQL date column as its calendar day unless the column says otherwise", () => {
    const day: ColumnMeta = {
      name: "secret",
      type: "date",
      nullable: true,
      unique: false,
      primaryKey: false,
      dateOnly: true,
    };
    const metaByField = new Map([["secret", day]]);
    const calendarDay = { kind: "date", calendarDay: true };
    expect(
      prerenderResourceCells<Row>(["secret"], [], reqCtx, { metaByField }).columns[0]?.format,
    ).toEqual(calendarDay);
    const declared = prerenderResourceCells<Row>(
      [{ field: "secret" }, { field: "secret", format: "relative" }],
      [],
      reqCtx,
      { metaByField },
    );
    expect(declared.columns[0]?.format).toEqual(calendarDay);
    expect(declared.columns[1]?.format).toBe("relative");
  });

  it("keeps a SQL date column a calendar day under a declared date format, unless it opts out", () => {
    const day: ColumnMeta = {
      name: "secret",
      type: "date",
      nullable: true,
      unique: false,
      primaryKey: false,
      dateOnly: true,
    };
    const { columns } = prerenderResourceCells<Row>(
      [
        { field: "secret", format: "date" },
        { field: "secret", format: { kind: "date", time: true } },
        { field: "secret", format: { kind: "date", calendarDay: false } },
      ],
      [],
      reqCtx,
      { metaByField: new Map([["secret", day]]) },
    );
    expect(columns.map((column) => column.format)).toEqual([
      { kind: "date", calendarDay: true },
      { kind: "date", time: true, calendarDay: true },
      { kind: "date", calendarDay: false },
    ]);
  });
});
