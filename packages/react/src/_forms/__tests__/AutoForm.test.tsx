// @vitest-environment happy-dom

import type { ColumnMeta } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AutoForm } from "../AutoForm.js";

afterEach(() => cleanup());

const cols: ColumnMeta[] = [
  { name: "id", type: "string", nullable: false, unique: false, primaryKey: true },
  { name: "email", type: "string", nullable: false, unique: false, primaryKey: false },
  { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
  { name: "active", type: "boolean", nullable: false, unique: false, primaryKey: false },
];

describe("AutoForm", () => {
  it("renders a field per non-PK column", () => {
    render(
      <AutoForm
        action={async () => ({ ok: true })}
        schema={z.object({
          email: z.string(),
          age: z.number().optional(),
          active: z.boolean(),
        })}
        columns={cols}
      />,
    );
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/age/i)).toBeTruthy();
    expect(screen.getByLabelText(/active/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^id$/i)).toBeNull(); // PK hidden
  });

  it("hides explicitly hidden fields", () => {
    render(
      <AutoForm
        action={async () => ({ ok: true })}
        schema={z.object({ email: z.string() })}
        columns={cols}
        hide={["age", "active"]}
      />,
    );
    expect(screen.queryByLabelText(/age/i)).toBeNull();
    expect(screen.queryByLabelText(/active/i)).toBeNull();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it("uses humanized labels", () => {
    render(
      <AutoForm
        action={async () => ({ ok: true })}
        schema={z.object({ firstName: z.string() })}
        columns={[
          { name: "firstName", type: "string", nullable: false, unique: false, primaryKey: false },
        ]}
      />,
    );
    expect(screen.getByLabelText("First Name")).toBeTruthy();
  });

  it("sets type=number for numeric columns", () => {
    render(
      <AutoForm
        action={async () => ({ ok: true })}
        schema={z.object({ age: z.number() })}
        columns={[
          { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
        ]}
      />,
    );
    const input = screen.getByLabelText(/age/i) as HTMLInputElement;
    expect(input.type).toBe("number");
  });
});
