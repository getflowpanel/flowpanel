import { describe, it, expect } from "vitest";
import { toCsv, toJson } from "../export.js";

describe("toCsv", () => {
  it("emits header + rows", () => {
    const out = toCsv(
      [
        { id: "1", email: "a@x.com", age: 30 },
        { id: "2", email: "b@x.com", age: 25 },
      ],
      ["id", "email", "age"],
    );
    expect(out).toBe("id,email,age\n1,a@x.com,30\n2,b@x.com,25\n");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const out = toCsv([{ note: `he said "hi"`, other: "a, b" }], ["note", "other"]);
    expect(out).toBe(`note,other\n"he said ""hi""","a, b"\n`);
  });

  it("serializes null and undefined as empty, Date as ISO", () => {
    const out = toCsv(
      [{ a: null, b: undefined, c: new Date("2026-01-15T00:00:00.000Z") }],
      ["a", "b", "c"],
    );
    expect(out).toBe("a,b,c\n,,2026-01-15T00:00:00.000Z\n");
  });

  it("handles empty rows array (header-only)", () => {
    expect(toCsv([], ["x", "y"])).toBe("x,y\n");
  });

  it("handles objects/arrays by JSON-stringifying and quoting", () => {
    const out = toCsv([{ meta: { tag: "a,b" } }], ["meta"]);
    // stringified value contains braces/commas/quotes → quoted + escaped
    expect(out).toBe(`meta\n"{""tag"":""a,b""}"\n`);
  });
});

describe("toJson", () => {
  it("emits a JSON array projecting only the requested fields", () => {
    const out = toJson(
      [
        { id: "1", email: "a@x.com", age: 30, secret: "redacted" },
        { id: "2", email: "b@x.com", age: 25, secret: "hidden" },
      ],
      ["id", "email"],
    );
    expect(JSON.parse(out)).toEqual([
      { id: "1", email: "a@x.com" },
      { id: "2", email: "b@x.com" },
    ]);
  });

  it("omits missing fields from each row", () => {
    const out = toJson([{ id: "1" }, { id: "2", email: "b@x.com" }], ["id", "email"]);
    expect(JSON.parse(out)).toEqual([
      { id: "1", email: undefined },
      { id: "2", email: "b@x.com" },
    ]);
  });
});
