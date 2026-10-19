// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const preload = vi.hoisted(() => vi.fn());

vi.mock("@flowpanel/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flowpanel/react")>()),
  preloadAutoForm: preload,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/customers",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CreateDrawerTrigger } from "../pages/CreateDrawer";

afterEach(() => {
  cleanup();
  preload.mockClear();
});

describe("a control that opens a form", () => {
  it("starts loading the form's code when the pointer or the focus reaches it", () => {
    render(<CreateDrawerTrigger label="New" />);
    const button = screen.getByRole("button", { name: "New" });
    fireEvent.pointerEnter(button);
    expect(preload).toHaveBeenCalledTimes(1);
    fireEvent.focus(button);
    expect(preload).toHaveBeenCalledTimes(2);
  });
});
