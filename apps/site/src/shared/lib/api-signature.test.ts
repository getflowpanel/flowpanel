import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { extractApiSymbol } from "./api-signature";

function fixtureProject(): Project {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile(
    "/public-api.ts",
    `
/** Runs the operation for a string or numeric key.\n * @deprecated Use execute instead.\n */
export function run(key: string): string;
export function run(key: number): number;
export function run(key: string | number): string | number { return key; }

/** Keeps the input type intact. */
export function createValue<T extends object>(value: T): T { return value; }
export { createValue as makeValue };

/** Current wire version. */
export const VERSION = "1.0.0" as const;

/** A typed value container. */
export class Box<T> {
  constructor(readonly value: T) {}
}
`,
  );
  return project;
}

describe("extractApiSymbol", () => {
  it("extracts overloads, documentation, and deprecation", () => {
    const result = extractApiSymbol({
      path: "/public-api.ts",
      name: "run",
      project: fixtureProject(),
    });

    expect(result).toEqual({
      name: "run",
      kind: "function",
      signatures: [
        "export function run(key: string): string;",
        "export function run(key: number): number;",
      ],
      description: "Runs the operation for a string or numeric key.",
      deprecated: "Use execute instead.",
      sourcePath: "/public-api.ts",
    });
  });

  it("preserves a generic signature under its public alias", () => {
    const result = extractApiSymbol({
      path: "/public-api.ts",
      name: "makeValue",
      project: fixtureProject(),
    });

    expect(result.name).toBe("makeValue");
    expect(result.signatures).toEqual([
      "export function makeValue<T extends object>(value: T): T;",
    ]);
  });

  it("extracts const and class declarations", () => {
    const project = fixtureProject();

    expect(extractApiSymbol({ path: "/public-api.ts", name: "VERSION", project })).toMatchObject({
      kind: "const",
      signatures: ['export const VERSION: "1.0.0";'],
    });
    expect(extractApiSymbol({ path: "/public-api.ts", name: "Box", project })).toMatchObject({
      kind: "class",
      signatures: ["export class Box<T> { constructor(value: T); }"],
    });
  });

  it("throws a useful error for a missing symbol", () => {
    expect(() =>
      extractApiSymbol({ path: "/public-api.ts", name: "missing", project: fixtureProject() }),
    ).toThrow(/missing.*public-api\.ts/i);
  });
});
