import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";

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

function isServerOnlySource(source: string): boolean {
  if (source === "server-only") return true;
  if (source.endsWith("/server-only")) return true;
  if (/(^|\/)db(\/|$)/.test(source) && /^[@~]?[/.]?/.test(source)) {
    if (
      source.startsWith("@/") ||
      source.startsWith("~/") ||
      source.startsWith("./") ||
      source.startsWith("../") ||
      source.startsWith("src/")
    ) {
      if (
        source === `${source.split("/")[0]}/db` ||
        source.includes("/db/") ||
        source.endsWith("/db")
      ) {
        return true;
      }
    }
  }
  if (/\/server(\/|$)/.test(source)) return true;
  return false;
}

export default rule;
