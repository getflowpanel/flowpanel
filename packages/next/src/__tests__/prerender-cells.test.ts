import type { ColumnDef, ColumnMeta, RequestContext } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { prerenderResourceCells } from "../runtime/prerender-cells.js";

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
  it("expands string column entries to PrerenderedColumn with just `field`", () => {
    const out = prerenderResourceCells<Row>(
      ["id", "email"],
      [{ id: "1", email: "a@b.com", tags: [], userId: "u1", secret: "" }],
      reqCtx,
    );
    expect(out.columns).toEqual([{ field: "id" }, { field: "email" }]);
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

  it("skips ColumnDef with no field", () => {
    const out = prerenderResourceCells<Row>([{ label: "ghost" } as ColumnDef<Row>], [], reqCtx);
    expect(out.columns).toHaveLength(0);
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
});
