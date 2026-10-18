import { describe, expect, it } from "vitest";
import { renderDetailFields } from "../pages/detail-tabs/detail-cells";
import { formatFieldValue } from "../runtime/format-field-value";

const reqCtx = {
  requestId: "r1",
  req: new Request("http://localhost/admin/customers/1"),
  session: { id: "me" },
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("an empty field on a record page", () => {
  it("leaves a render that draws nothing, and blank markdown, to the formatted value", async () => {
    const shown = await renderDetailFields(
      { vip: false, notes: "  ", flag: false, nick: "", name: "Ada" },
      [
        { name: "vip", render: () => null },
        { name: "notes" },
        { name: "flag", render: () => false },
        { name: "nick", render: () => "" },
        { name: "name", render: () => "Ada L." },
      ],
      reqCtx,
      new Set(["notes"]),
    );
    expect([...shown.keys()]).toEqual(["name"]);
  });

  it("reads an empty string as a dash, like a list cell", () => {
    expect(formatFieldValue("")).toBe("—");
    expect(formatFieldValue(null)).toBe("—");
  });
});
