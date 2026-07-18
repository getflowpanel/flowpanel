import { describe, expect, it } from "vitest";
import {
  declaredFieldSet,
  parseListParams,
  resolveFilterSpecs,
  sanitizeFilterValues,
} from "../runtime/parse-list-params.js";

describe("parseListParams", () => {
  it("parses page, q, sort, f_* filters", () => {
    const sp = new URLSearchParams("?page=3&q=bob&sort=email:desc&f_plan=pro&f_status=active");
    const r = parseListParams(sp);
    expect(r.page).toBe(3);
    expect(r.search).toBe("bob");
    expect(r.sort).toEqual({ field: "email", dir: "desc" });
    expect(r.filters).toEqual({ plan: "pro", status: "active" });
  });

  it("ignores unprefixed keys", () => {
    const sp = new URLSearchParams("?plan=pro"); // not f_plan
    expect(parseListParams(sp).filters).toEqual({});
  });

  it("falls back to defaultSort when no ?sort", () => {
    const r = parseListParams(new URLSearchParams(""), { field: "createdAt", dir: "desc" });
    expect(r.sort).toEqual({ field: "createdAt", dir: "desc" });
  });

  it("invalid sort format yields null", () => {
    const r = parseListParams(new URLSearchParams("?sort=bogus"));
    expect(r.sort).toBeNull();
  });

  it("allowlist drops filter keys not in declared fields", () => {
    const allowed = new Set(["email", "status"]);
    const sp = new URLSearchParams("?f_email=a@b.co&f_passwordHash=secret&f_status=active");
    const r = parseListParams(sp, undefined, allowed);
    expect(r.filters).toEqual({ email: "a@b.co", status: "active" });
  });

  it("allowlist ignores a sort on an undeclared field", () => {
    const allowed = new Set(["email"]);
    const r = parseListParams(new URLSearchParams("?sort=ssn:asc"), undefined, allowed);
    expect(r.sort).toBeNull();
  });

  it("allowlist permits a sort on a declared field", () => {
    const allowed = new Set(["email"]);
    const r = parseListParams(new URLSearchParams("?sort=email:desc"), undefined, allowed);
    expect(r.sort).toEqual({ field: "email", dir: "desc" });
  });

  it("clamps an absurdly large ?page= instead of passing it through", () => {
    const r = parseListParams(new URLSearchParams("?page=1e12"));
    expect(r.page).toBeLessThanOrEqual(100_000);
    expect(Number.isInteger(r.page)).toBe(true);
  });

  it("truncates a fractional ?page= to an integer", () => {
    const r = parseListParams(new URLSearchParams("?page=1.9"));
    expect(r.page).toBe(1);
  });

  it("floors non-finite ?page= (Infinity, NaN) to 1", () => {
    expect(parseListParams(new URLSearchParams("?page=Infinity")).page).toBe(1);
    expect(parseListParams(new URLSearchParams("?page=not-a-number")).page).toBe(1);
  });

  it("floors a negative or zero ?page= to 1", () => {
    expect(parseListParams(new URLSearchParams("?page=-5")).page).toBe(1);
    expect(parseListParams(new URLSearchParams("?page=0")).page).toBe(1);
  });
});

describe("declaredFieldSet", () => {
  it("unions string + ColumnDef columns, filters, search and defaultSort", () => {
    const set = declaredFieldSet({
      columns: ["email", { field: "name" }, { render: () => null }],
      filters: ["status", { field: "categoryId" }],
      search: ["title"],
      defaultSort: { field: "createdAt" },
    });
    expect([...set].sort()).toEqual(
      ["categoryId", "createdAt", "email", "name", "status", "title"].sort(),
    );
  });

  it("tolerates missing groups", () => {
    expect(declaredFieldSet({ columns: ["a"] })).toEqual(new Set(["a"]));
    expect(declaredFieldSet({})).toEqual(new Set());
  });
});

describe("resolveFilterSpecs", () => {
  it("converts string keys to text filter defs", async () => {
    const r = await resolveFilterSpecs(["email"], {});
    expect(r).toEqual([{ field: "email", type: "text" }]);
  });

  it("passes through explicit FilterDef with inline options", async () => {
    const r = await resolveFilterSpecs(
      [{ field: "plan", type: "select", label: "Plan", options: [{ label: "Pro", value: "pro" }] }],
      {},
    );
    expect(r).toEqual([
      { field: "plan", type: "select", label: "Plan", options: [{ label: "Pro", value: "pro" }] },
    ]);
  });

  it("awaits async options callback", async () => {
    const r = await resolveFilterSpecs(
      [{ field: "tag", type: "multiselect", options: async () => [{ label: "X", value: "x" }] }],
      {},
    );
    expect(r[0]?.options).toEqual([{ label: "X", value: "x" }]);
  });
});

describe("sanitizeFilterValues", () => {
  const selectSpec = [
    {
      field: "status",
      type: "select" as const,
      options: [
        { label: "Needs review", value: "needs_review" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Rejected", value: "rejected" },
      ],
    },
  ];

  it("drops a bogus enum value not in the declared select options (the reported 500)", () => {
    // Reproduces `?f_status=pending` against a `select` FilterDef whose
    // options are `needs_review | confirmed | rejected` — the exact class
    // of value that used to reach `eq(column, "pending")` in the adapter
    // and crash on `invalid input value for enum match_status: "pending"`.
    const out = sanitizeFilterValues({ status: "pending" }, selectSpec);
    expect(out).toEqual({});
  });

  it("keeps a select value that IS in the declared options", () => {
    const out = sanitizeFilterValues({ status: "confirmed" }, selectSpec);
    expect(out).toEqual({ status: "confirmed" });
  });

  it("multiselect: decodes to a structured FilterInValue, dropping out-of-range entries", () => {
    const specs = [
      {
        field: "tags",
        type: "multiselect" as const,
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    // Reproduces the reported bug: `eq(col, "a,b")` used to silently match
    // nothing. The decoded shape lets the adapter build `col IN (...)`.
    expect(sanitizeFilterValues({ tags: "a,bogus,b" }, specs)).toEqual({
      tags: { op: "in", values: ["a", "b"] },
    });
    expect(sanitizeFilterValues({ tags: "bogus" }, specs)).toEqual({});
  });

  it("multiselect: decodes every value when the FilterDef declares no options allowlist", () => {
    const specs = [{ field: "tags", type: "multiselect" as const }];
    expect(sanitizeFilterValues({ tags: "a,b,c" }, specs)).toEqual({
      tags: { op: "in", values: ["a", "b", "c"] },
    });
  });

  it("boolean filter: drops a non-'true'/'false' value", () => {
    const specs = [{ field: "active", type: "boolean" as const }];
    expect(sanitizeFilterValues({ active: "true" }, specs)).toEqual({ active: "true" });
    expect(sanitizeFilterValues({ active: "yes" }, specs)).toEqual({});
  });

  it("numeric-range filter: decodes to a structured FilterRangeValue", () => {
    const specs = [{ field: "confidence", type: "numeric-range" as const }];
    // Reproduces the reported bug: `eq(price_cents, "100:500")` used to 500
    // the whole page with a Postgres type error. The decoded shape lets the
    // adapter build `col >= gte AND col <= lte`.
    // one bogus side — keep only the valid side
    expect(sanitizeFilterValues({ confidence: "0.5:abc" }, specs)).toEqual({
      confidence: { op: "range", gte: 0.5 },
    });
    // both sides valid
    expect(sanitizeFilterValues({ confidence: "0.2:0.8" }, specs)).toEqual({
      confidence: { op: "range", gte: 0.2, lte: 0.8 },
    });
    // only the max side filled (min empty, e.g. "100:500" → ":500")
    expect(sanitizeFilterValues({ confidence: ":0.8" }, specs)).toEqual({
      confidence: { op: "range", lte: 0.8 },
    });
    // both sides bogus — the whole filter is dropped
    expect(sanitizeFilterValues({ confidence: "abc:xyz" }, specs)).toEqual({});
  });

  it("daterange filter: decodes to a structured FilterRangeValue, `to` inclusive of the whole day", () => {
    const specs = [{ field: "createdAt", type: "daterange" as const }];
    const out = sanitizeFilterValues({ createdAt: "2024-01-01:2024-01-31" }, specs);
    const range = out.createdAt as { op: string; gte: Date; lte: Date };
    expect(range.op).toBe("range");
    expect(range.gte.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2024-01-31T23:59:59.999Z");
  });

  it("daterange filter: drops a malformed date bound instead of crashing", () => {
    const specs = [{ field: "createdAt", type: "daterange" as const }];
    expect(sanitizeFilterValues({ createdAt: "not-a-date:also-bad" }, specs)).toEqual({});
    // one good side is kept
    const out = sanitizeFilterValues({ createdAt: "2024-01-01:bogus" }, specs);
    expect((out.createdAt as { lte?: unknown }).lte).toBeUndefined();
    expect((out.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
  });

  it("preserves the __null__ / __notnull__ sentinels regardless of declared type", () => {
    const out = sanitizeFilterValues(
      { status: "__null__", confidence: "__notnull__", createdAt: "__null__", tags: "__null__" },
      [
        ...selectSpec,
        { field: "confidence", type: "numeric-range" as const },
        { field: "createdAt", type: "daterange" as const },
        { field: "tags", type: "multiselect" as const },
      ],
    );
    expect(out).toEqual({
      status: "__null__",
      confidence: "__notnull__",
      createdAt: "__null__",
      tags: "__null__",
    });
  });

  it("passes a field through unchanged when it has no resolved FilterDef (plain column filter)", () => {
    // `parseListParams`'s `allowedFields` also allows plain declared columns
    // as filter keys with no `FilterDef` behind them — nothing declared to
    // validate the value against, so the existing permissive behavior holds.
    expect(sanitizeFilterValues({ email: "anything at all" }, [])).toEqual({
      email: "anything at all",
    });
  });
});
