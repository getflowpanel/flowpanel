import { describe, expect, it } from "vitest";
import {
  declaredFieldSet,
  parseListParams,
  resolveFilterSpecs,
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
