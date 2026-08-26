import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";

type MessageId = "serverImport";

/** Files marked with `"use client"` cannot import server-only modules. */
const rule = createRule<[], MessageId>({
  name: "no-server-import-in-client",
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow importing server-only modules from a `"use client"` file.',
    },
    messages: {
      serverImport:
        '`{{source}}` is server-only; importing it from a `"use client"` file ships server code to the browser. Move the call to a server action or route handler.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(program: TSESTree.Program): void {
        if (!hasUseClientDirective(program)) return;

        for (const stmt of program.body) {
          if (stmt.type !== AST_NODE_TYPES.ImportDeclaration) continue;
          // `import type` is erased before bundling, so nothing reaches the browser.
          if (stmt.importKind === "type") continue;
          const source = stmt.source.value;
          if (typeof source !== "string") continue;
          if (!isServerOnlySource(source)) continue;
          context.report({
            node: stmt.source,
            messageId: "serverImport",
            data: { source },
          });
        }
      },
    };
  },
});

function hasUseClientDirective(program: TSESTree.Program): boolean {
  for (const stmt of program.body) {
    if (stmt.type !== AST_NODE_TYPES.ExpressionStatement) break;
    const expr = stmt.expression;
    if (expr.type !== AST_NODE_TYPES.Literal) break;
    if (expr.value === "use client") return true;
    if (typeof expr.value !== "string") break;
  }
  return false;
}

/** Alias or relative specifiers — the only ones that can name the app's own modules. */
function isAppLocal(source: string): boolean {
  return (
    source.startsWith("@/") ||
    source.startsWith("~/") ||
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("src/")
  );
}

/** `next/server` is a Next.js request-primitive entry point, safe in a client file. */
function isAllowedPackageServerEntry(source: string): boolean {
  return source === "next/server" || source.startsWith("next/server/");
}

function isServerOnlySource(source: string): boolean {
  if (source === "server-only") return true;
  if (source.endsWith("/server-only")) return true;
  if (isAllowedPackageServerEntry(source)) return false;
  if (isAppLocal(source) && /(^|\/)db(\/|$)/.test(source)) {
    if (
      source === `${source.split("/")[0]}/db` ||
      source.includes("/db/") ||
      source.endsWith("/db")
    ) {
      return true;
    }
  }
  return /\/server(\/|$)/.test(source);
}

export default rule;
