import { describe, expect, it } from "vitest";
import { renderTemplate } from "../template.js";

describe("renderTemplate", () => {
  it("substitutes {{KEY}} placeholders", () => {
    expect(renderTemplate("Hello {{NAME}}!", { NAME: "World" })).toBe("Hello World!");
  });
  it("handles multiple keys and whitespace", () => {
    expect(renderTemplate("{{ A }} + {{B}} = {{C}}", { A: "1", B: "2", C: "3" })).toBe("1 + 2 = 3");
  });
  it("replaces missing keys with empty string", () => {
    expect(renderTemplate("Hi {{MISSING}}!", {})).toBe("Hi !");
  });
});
