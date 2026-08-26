import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProgram } from "../../../../../packages/cli/src/program";
import { buildCliReference } from "../../../../../scripts/docs/cli-metadata";
import { readCliReference } from "./cli-reference";

describe("readCliReference", () => {
  it("matches every option to Commander help and preserves defaults", () => {
    const program = createProgram();
    const docs = readCliReference();
    expect(docs).toEqual(buildCliReference(program));
    const commands = [program, ...program.commands];

    expect(docs.map((command) => command.name)).toEqual([
      "flowpanel",
      "init",
      "migrate",
      "doctor",
      "eject",
      "dev",
      "new",
    ]);

    for (const [index, doc] of docs.entries()) {
      const help = commands[index]?.helpInformation() ?? "";
      for (const option of doc.options) expect(help).toContain(option.flags);
    }

    expect(docs.find((command) => command.name === "dev")?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flags: "--port <port>", defaultValue: "3000" }),
      ]),
    );
    expect(docs.find((command) => command.name === "new")?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flags: "--kind <kind>", defaultValue: "drizzle" }),
      ]),
    );
  });

  it("is never imported by a client component", () => {
    const sourceRoot = join(import.meta.dirname, "../..");
    const files: string[] = [];
    const visit = (directory: string): void => {
      for (const name of readdirSync(directory)) {
        const file = join(directory, name);
        if (statSync(file).isDirectory()) visit(file);
        else if (/\.(?:ts|tsx)$/.test(name)) files.push(file);
      }
    };
    visit(sourceRoot);

    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /^\s*["']use client["'];/m.test(source) && source.includes("cli-reference");
    });
    expect(offenders).toEqual([]);
  });
});
