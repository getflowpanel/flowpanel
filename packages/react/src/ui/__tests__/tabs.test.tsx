// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

afterEach(cleanup);

function Controlled({
  value,
  onValueChange,
  manual,
}: {
  value: string;
  onValueChange: (next: string) => void;
  manual?: boolean;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      {...(manual ? { activationMode: "manual" } : {})}
    >
      <TabsList>
        <TabsTrigger value="fields">Fields</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

describe("a tab clicked with the mouse", () => {
  it("activates under manual activation", () => {
    const onValueChange = vi.fn();
    render(<Controlled value="fields" onValueChange={onValueChange} manual />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Invoices" }), { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("invoices");
  });

  it("activates again when it is already focused, as after Back restores the first tab", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Controlled value="fields" onValueChange={onValueChange} />);
    const invoices = screen.getByRole("tab", { name: "Invoices" });
    fireEvent.mouseDown(invoices, { button: 0 });
    rerender(<Controlled value="invoices" onValueChange={onValueChange} />);
    rerender(<Controlled value="fields" onValueChange={onValueChange} />);
    expect(document.activeElement).toBe(invoices);
    onValueChange.mockClear();
    fireEvent.mouseDown(invoices, { button: 0 });
    expect(onValueChange).toHaveBeenCalledWith("invoices");
  });
});
