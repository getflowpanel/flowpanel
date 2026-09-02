import { AutoTypeTable as BaseAutoTypeTable } from "fumadocs-typescript/ui";
import type { ComponentProps } from "react";
import { getTypeGenerator } from "./type-project";

/**
 * Renders a property table straight from a TypeScript declaration, so the docs
 * cannot drift from the types. Point it at a package source file:
 *
 * ```mdx
 * <AutoTypeTable path="../../packages/core/src/types/resource.ts" name="ResourceOptions" />
 * ```
 */
export function AutoTypeTable(props: Omit<ComponentProps<typeof BaseAutoTypeTable>, "generator">) {
  return <BaseAutoTypeTable {...props} generator={getTypeGenerator()} />;
}
