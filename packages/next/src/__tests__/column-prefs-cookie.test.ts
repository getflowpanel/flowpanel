import { describe, expect, it } from "vitest";
import { columnPrefsCookie, fitColumnPrefs, readColumnPrefs } from "../drawer/column-prefs-cookie";

const header = (assignment: string) => `theme=dark; ${assignment.split(";")[0]}; other=1`;
const EMPTY = { widths: {}, visibility: {} };

describe("column prefs cookie", () => {
  it("round-trips widths and hidden columns for one resource, scoped to its list's path", () => {
    const prefs = { widths: { email: 220 }, visibility: { plan: false } };
    const cookie = columnPrefsCookie("users", prefs, "/admin/users");
    expect(cookie).toContain("; path=/admin/users;");
    expect(readColumnPrefs(header(cookie), "users")).toEqual(prefs);
    expect(readColumnPrefs(header(cookie), "orders")).toEqual(EMPTY);
  });

  it("drops malformed widths and flags", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ widths: { a: 10, b: "x", c: 180 }, visibility: { d: "no", e: false } }),
    );
    expect(readColumnPrefs(`fp-columns-users=${raw}`, "users")).toEqual({
      widths: { c: 180 },
      visibility: { e: false },
    });
    expect(readColumnPrefs("fp-columns-users=%7Bnot", "users")).toEqual(EMPTY);
  });

  it("forgets the cookie once every column is back to its default", () => {
    expect(
      columnPrefsCookie("users", { widths: {}, visibility: { plan: true } }, "/admin/users"),
    ).toBe("fp-columns-users=; path=/admin/users; max-age=0; samesite=lax");
  });

  it("stays under the browser's cookie size, dropping widths first", () => {
    const widths = Object.fromEntries(
      Array.from({ length: 300 }, (_, i) => [`a_rather_long_column_name_${i}`, 120]),
    );
    const cookie = columnPrefsCookie(
      "users",
      { widths, visibility: { plan: false } },
      "/admin/users",
    );
    expect(cookie.length).toBeLessThan(4000);
    expect(readColumnPrefs(header(cookie), "users")).toEqual({
      widths: {},
      visibility: { plan: false },
    });
  });
});

describe("fitting prefs to the list's columns", () => {
  const columns = [{ field: "email" }, { field: "plan" }, { field: "secret", hidden: true }];

  it("drops names the list no longer has", () => {
    const fitted = fitColumnPrefs(
      { widths: { email: 200, gone: 300 }, visibility: { renamed: false, plan: false } },
      columns,
    );
    expect(fitted).toEqual({ widths: { email: 200 }, visibility: { plan: false } });
  });

  it("never hides every column: the first one stays shown", () => {
    const fitted = fitColumnPrefs(
      { widths: {}, visibility: { email: false, plan: false } },
      columns,
    );
    expect(fitted.visibility).toEqual({ plan: false });
  });
});
