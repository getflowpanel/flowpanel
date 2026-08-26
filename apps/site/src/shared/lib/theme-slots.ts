import { resolve } from "node:path";
import { SyntaxKind } from "ts-morph";
import { getTypeProject } from "./type-project";

export interface ThemeSlotDoc {
  name: string;
  type: string;
}

export function readThemeSlots(siteRoot = process.cwd()): ThemeSlotDoc[] {
  const file = resolve(siteRoot, "../../packages/react/src/_provider/ComponentsContext.tsx");
  const project = getTypeProject();
  const source = project.getSourceFile(file) ?? project.addSourceFileAtPath(file);
  const declarations = source
    .getDescendantsOfKind(SyntaxKind.InterfaceDeclaration)
    .filter((declaration) => declaration.getName() === "FlowpanelComponentSlots");

  const slots = declarations.flatMap((declaration) =>
    declaration.getProperties().map((property) => ({
      name: property.getName(),
      type: property.getTypeNode()?.getText() ?? property.getType().getText(property),
    })),
  );
  return slots.sort((a, b) => a.name.localeCompare(b.name));
}
