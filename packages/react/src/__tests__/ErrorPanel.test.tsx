import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorPanel } from "../components/ErrorPanel";

describe("ErrorPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows warning when error rate > 10%", () => {
    render(
      <ErrorPanel
        errors={[{ errorClass: "TimeoutError", count: 5 }]}
        totalFailed={15}
        totalRuns={100}
        loading={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("15% error rate");
  });

  it("calls onErrorClick with error class when clicked", () => {
    const onErrorClick = vi.fn();

    render(
      <ErrorPanel
        errors={[{ errorClass: "TimeoutError", count: 5 }]}
        totalFailed={5}
        totalRuns={100}
        loading={false}
        onErrorClick={onErrorClick}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onErrorClick).toHaveBeenCalledWith("TimeoutError");
  });
});
