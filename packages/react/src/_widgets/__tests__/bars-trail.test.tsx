// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarsCard } from "../BarsCard";

afterEach(cleanup);

describe("BarsCard shares and changes", () => {
  it("shows each row's share of the rows' total", () => {
    const { container } = render(
      <BarsCard
        share
        rows={[
          { label: "kwork", value: 60 },
          { label: "fl.ru", value: 30 },
          { label: "weblancer", value: 10 },
        ]}
      />,
    );
    expect([...container.querySelectorAll("[data-share]")].map((n) => n.textContent)).toEqual([
      "60%",
      "30%",
      "10%",
    ]);
  });

  it("prefers a row's own share of the real total, for a top-N query", () => {
    const { container } = render(
      <BarsCard
        share
        rows={[
          { label: "kwork", value: 60, share: 0.3 },
          { label: "fl.ru", value: 40 },
        ]}
      />,
    );
    expect([...container.querySelectorAll("[data-share]")].map((n) => n.textContent)).toEqual([
      "30%",
      "40%",
    ]);
  });

  it("marks each row's change against its previous value", () => {
    const { container } = render(
      <BarsCard
        rows={[
          { label: "kwork", value: 120, previous: 100 },
          { label: "fl.ru", value: 5, previous: 2 },
          { label: "weblancer", value: 50, previous: 50 },
        ]}
      />,
    );
    const marks = [...container.querySelectorAll("[data-delta]")];
    expect(marks.map((n) => n.textContent)).toEqual(["▲ 20%", "▲ +3", "0%"]);
    expect(marks.map((n) => n.getAttribute("data-delta"))).toEqual(["good", "good", "flat"]);
  });

  it("reads a fall as good news for goodWhen: down", () => {
    const { container } = render(
      <BarsCard goodWhen="down" rows={[{ label: "errors", value: 10, previous: 40 }]} />,
    );
    expect(container.querySelector("[data-delta]")?.getAttribute("data-delta")).toBe("good");
  });

  it("shows neither without share or a previous value", () => {
    const { container } = render(<BarsCard rows={[{ label: "kwork", value: 3 }]} />);
    expect(container.querySelector("[data-share]")).toBeNull();
    expect(container.querySelector("[data-delta]")).toBeNull();
  });
});
