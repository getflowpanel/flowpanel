import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const coreIndex = fileURLToPath(new URL("../index.ts", import.meta.url));
const snippet = fileURLToPath(new URL("./metric-typo.fixture.ts", import.meta.url));

const source = `import { metric } from "@flowpanel/core";
declare module "@flowpanel/core" {
  interface FlowpanelResources {
    runs: { id: number; startedAt: Date };
  }
}
export const typo = metric("Runs", { count: "run" });
`;

function diagnostics(): string[] {
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    paths: { "@flowpanel/core": [coreIndex] },
  };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host);
  host.readFile = (name) => (name === snippet ? source : read(name));
  host.fileExists = (
    (exists) => (name: string) =>
      name === snippet || exists(name)
  )(host.fileExists.bind(host));
  const program = ts.createProgram([snippet], options, host);
  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile(snippet))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("a metric that counts a misspelled resource", () => {
  it("names the resource it expected, not the query signature", () => {
    const messages = diagnostics();
    expect(messages).toEqual([`Type '"run"' is not assignable to type '"runs"'.`]);
  }, 60_000);
});
