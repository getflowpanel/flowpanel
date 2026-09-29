import { AutoTypeTable as BaseAutoTypeTable } from "fumadocs-typescript/ui";
import type { ComponentProps } from "react";
import { getTypeGenerator } from "./type-project";

// Property table read from a TypeScript declaration, so the docs cannot drift from the types.
export function AutoTypeTable(props: Omit<ComponentProps<typeof BaseAutoTypeTable>, "generator">) {
  return <BaseAutoTypeTable {...props} generator={getTypeGenerator()} />;
}
