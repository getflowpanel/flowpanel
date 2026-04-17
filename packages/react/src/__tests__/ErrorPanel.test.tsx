import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorPanel } from "../components/ErrorPanel";

describe("ErrorPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there are zero failed runs", () => {
    const { container } = render(<ErrorPanel errors={[]} totalFailed={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows summary with failed-run count and each error class", () => {
    render(
      <ErrorPanel
        errors={[
          { errorClass: "TimeoutError", count: 5 },
          { errorClass: "ValidationError", count: 3 },
        ]}
        totalFailed={8}
      />,
    );
    expect(screen.getByLabelText("Error summary")).toBeInTheDocument();
    expect(screen.getByText(/8 failed runs/i)).toBeInTheDocument();
    expect(screen.getByText("TimeoutError")).toBeInTheDocument();
    expect(screen.getByText("ValidationError")).toBeInTheDocument();
  });

  it("calls onErrorClick with the error class when a row is clicked", () => {
    const onErrorClick = vi.fn();
    render(
      <ErrorPanel
        errors={[{ errorClass: "TimeoutError", count: 5 }]}
        totalFailed={5}
        onErrorClick={onErrorClick}
      />,
    );

    const row = screen.getByLabelText("TimeoutError: 5 occurrences");
    fireEvent.click(row);
    expect(onErrorClick).toHaveBeenCalledWith("TimeoutError");
  });

  it("calls onRetryAll when retry button is shown and clicked", () => {
    const onRetryAll = vi.fn();
    render(
      <ErrorPanel
        errors={[{ errorClass: "TimeoutError", count: 5 }]}
        totalFailed={5}
        onRetryAll={onRetryAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry all failed runs/i }));
    expect(onRetryAll).toHaveBeenCalledOnce();
  });
});
