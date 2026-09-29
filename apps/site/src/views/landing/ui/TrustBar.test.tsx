import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustBar } from "./TrustBar";

describe("TrustBar", () => {
  it("names every supported framework and adapter", () => {
    const html = renderToStaticMarkup(createElement(TrustBar));

    expect(html).toContain("Works with");
    for (const name of ["Next.js 16.3+", "React 19", "Drizzle", "Prisma 5–6", "TypeScript"]) {
      expect(html).toContain(name);
    }
  });
});
