// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../_feedback/Toast.js";
import { CopyButton } from "../CopyButton.js";

afterEach(cleanup);

describe("CopyButton", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the given text on click", async () => {
    render(
      <ToastProvider>
        <CopyButton text="hello-world" />
      </ToastProvider>,
    );
    const btn = screen.getByRole("button", { name: "Copy" });
    btn.click();
    // microtask flush
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("hello-world");
  });

  it("uses a custom label", () => {
    render(
      <ToastProvider>
        <CopyButton text="x" label="Copy ID" />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "Copy ID" })).toBeTruthy();
  });
});
