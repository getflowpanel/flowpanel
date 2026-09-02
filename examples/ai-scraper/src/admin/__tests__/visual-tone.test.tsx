import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MetricCard } from "../MetricCard";
import { ReviewQueue } from "../ReviewQueue";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("demo warning tone", () => {
  it("keeps review numbers neutral and uses a compact warning indicator", () => {
    const html = renderToStaticMarkup(
      <ReviewQueue
        pending={25}
        outcomes={[
          { label: "Confirmed", count: 24, share: 43, tone: "default" },
          { label: "Needs review", count: 10, share: 18, tone: "warn" },
        ]}
      />,
    );

    expect(html).not.toContain("text-fp-warn-text");
    expect(html).toContain("bg-fp-warn");
  });

  it("keeps warning metric values neutral and uses a compact warning indicator", () => {
    const html = renderToStaticMarkup(<MetricCard label="Needs review" value={10} tone="warn" />);

    expect(html).not.toContain("text-fp-warn-text");
    expect(html).toContain("bg-fp-warn");
  });
});
