import { describe, expect, it } from "vitest";
import { csvField } from "../internal/csv-field";

describe("csvField", () => {
  it("defuses a leading formula sigil before quoting", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-1,5")).toBe(`"'-1,5"`);
    expect(csvField("@x")).toBe("'@x");
    expect(csvField("\tx")).toBe("'\tx");
  });

  it("quotes commas, quotes and line breaks and leaves plain text alone", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(csvField("plain")).toBe("plain");
  });
});
