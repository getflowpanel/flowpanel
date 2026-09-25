// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KvCard } from "../KvCard";

afterEach(cleanup);

describe("KvCard long values", () => {
  it("spans the card, keeps line breaks and folds the rest under its summary", () => {
    const { container } = render(
      <KvCard
        items={[
          { label: "Bio", value: "one\ntwo", long: true, rest: "three", more: "Show all" },
          { label: "Plan", value: "pro" },
        ]}
      />,
    );
    const long = container.querySelector("dd[data-long]") as HTMLElement;
    expect(long.parentElement?.className).toContain("col-span-full");
    expect(long.className).toContain("whitespace-pre-wrap");
    expect(long.className).not.toContain("line-clamp-2");
    expect(long.getAttribute("title")).toBeNull();
    expect(long.textContent?.startsWith("one\ntwo")).toBe(true);
    const details = long.querySelector("details") as HTMLElement;
    expect(details.querySelector("summary")?.textContent).toBe("Show all");
    expect(details.textContent).toContain("three");
    expect(screen.getByText("pro").className).toContain("line-clamp-2");
  });

  it("renders a short long value without a fold", () => {
    const { container } = render(<KvCard items={[{ label: "Bio", value: "hi", long: true }]} />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("dd[data-long]")?.textContent).toBe("hi");
  });
});
