// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/user/1",
}));

import { DetailTabsClient } from "../pages/DetailTabsClient";

afterEach(cleanup);

describe("DetailTabsClient", () => {
  it("names every tab trigger by its key, and marks the open one", () => {
    const { container } = render(
      <DetailTabsClient
        tabs={[
          { key: "summary", label: "Сводка", content: <p>summary</p> },
          { key: "activity", label: "Активность", content: <p>activity</p> },
          { key: "timeline", label: "Лента", content: <p>timeline</p> },
        ]}
      />,
    );
    const triggers = [...container.querySelectorAll("[data-fp-tab]")];
    expect(triggers.map((el) => el.getAttribute("data-fp-tab"))).toEqual([
      "summary",
      "activity",
      "timeline",
    ]);
    expect(triggers.map((el) => el.getAttribute("data-state"))).toEqual([
      "active",
      "inactive",
      "inactive",
    ]);
  });

  it("scrolls its strip sideways on a narrow screen instead of widening the page", () => {
    const { getByRole } = render(
      <DetailTabsClient tabs={[{ key: "summary", label: "Сводка", content: <p>summary</p> }]} />,
    );
    const strip = getByRole("tablist");
    expect(strip.className).toContain("max-w-full");
    expect(strip.className).toContain("overflow-x-auto");
    expect(strip.className).toContain("justify-start");
  });
});
