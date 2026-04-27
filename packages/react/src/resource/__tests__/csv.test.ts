import type { SerializedColumn } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

function col(
  id: string,
  label: string,
  path: string | null,
  opts: Partial<SerializedColumn["opts"]> = {},
): SerializedColumn {
  return {
    id,
    label,
    path,
    type: "field",
    format: "text",
    opts: { visible: "list", ...opts },
  } as SerializedColumn;
}

describe("toCsv", () => {
  it("emits header + comma-separated rows", () => {
    const rows = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const cols = [col("id", "ID", "id"), col("name", "Name", "name")];
    expect(toCsv(rows, cols)).toBe("ID,Name\n1,Alice\n2,Bob");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    const rows = [{ text: 'a, b "c"\nd' }];
    const cols = [col("text", "Text", "text")];
    expect(toCsv(rows, cols)).toBe('Text\n"a, b ""c""\nd"');
  });

  it("skips detail-only columns", () => {
    const rows = [{ id: 1, secret: "x" }];
    const cols = [col("id", "ID", "id"), col("secret", "Secret", "secret", { visible: "detail" })];
    expect(toCsv(rows, cols)).toBe("ID\n1");
  });

  it("serializes dates as ISO strings", () => {
    const rows = [{ d: new Date("2026-04-18T12:00:00Z") }];
    const cols = [col("d", "Date", "d")];
    expect(toCsv(rows, cols)).toBe("Date\n2026-04-18T12:00:00.000Z");
  });

  it("stringifies objects into JSON", () => {
    const rows = [{ meta: { n: 1 } }];
    const cols = [col("meta", "Meta", "meta")];
    expect(toCsv(rows, cols)).toBe(`Meta\n"{""n"":1}"`);
  });
});
