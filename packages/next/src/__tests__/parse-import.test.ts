import { describe, expect, it } from "vitest";
import { parseImport } from "../runtime/parse-import";

describe("parseImport", () => {
  it("parses a JSON array of objects", () => {
    expect(parseImport("json", '[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("rejects non-array / invalid JSON", () => {
    expect(() => parseImport("json", '{"a":1}')).toThrow();
    expect(() => parseImport("json", "nope")).toThrow();
  });

  it("keeps non-object JSON elements (rejected per-row by the import loop, not aborted)", () => {
    expect(parseImport("json", '[{"a":1},null,5]')).toEqual([{ a: 1 }, null, 5]);
  });

  it("skips empty-name CSV header columns (trailing comma)", () => {
    expect(parseImport("csv", "a,b,\n1,2,3")).toEqual([{ a: "1", b: "2" }]);
  });

  it("parses simple CSV against the header row", () => {
    expect(parseImport("csv", "email,name\na@b.com,Alice\nc@d.com,Bob")).toEqual([
      { email: "a@b.com", name: "Alice" },
      { email: "c@d.com", name: "Bob" },
    ]);
  });

  it("handles quoted fields, embedded commas, and escaped quotes", () => {
    expect(parseImport("csv", 'name,note\n"Smith, John","say ""hi"""')).toEqual([
      { name: "Smith, John", note: 'say "hi"' },
    ]);
  });

  it("handles CRLF and drops blank lines", () => {
    expect(parseImport("csv", "a,b\r\n1,2\r\n\r\n")).toEqual([{ a: "1", b: "2" }]);
  });
});
