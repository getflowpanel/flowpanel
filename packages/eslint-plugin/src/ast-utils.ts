import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

/** The property named `name`, whether it was written as an identifier or a string key. */
export function findPropertyByName(
  obj: TSESTree.ObjectExpression,
  name: string,
): TSESTree.Property | null {
  for (const prop of obj.properties) {
    if (prop.type !== AST_NODE_TYPES.Property) continue;
    const key = prop.key;
    if (key.type === AST_NODE_TYPES.Identifier && key.name === name) return prop;
    if (key.type === AST_NODE_TYPES.Literal && key.value === name) return prop;
  }
  return null;
}

/** The node's value when it is a string literal, else `null`. */
export function asStringLiteral(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return node.value;
  }
  return null;
}
