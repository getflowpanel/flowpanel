import { Node, Project } from "ts-morph";

/** Remove the `resource(<refMatchingName>, …)` call from a flowpanel.config.ts source. */
export function editConfigToCommentResource(
  source: string,
  resourceName: string,
  filename = "flowpanel.config.ts",
  appDir = "app",
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(filename, source);

  let removed = false;
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    const calleeText = callee.getText().trim();
    if (calleeText !== "resource") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const text = first.getText().trim();

    const dotMatch = /\.([A-Za-z_][\w$]*)\s*$/.exec(text);
    if (dotMatch && dotMatch[1] === resourceName) {
      replaceCallInArray(node);
      removed = true;
      return;
    }
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      replaceCallInArray(node);
      removed = true;
      return;
    }
    if (text === resourceName) {
      replaceCallInArray(node);
      removed = true;
    }
  });

  if (!removed) {
    throw new Error(`eject: resource "${resourceName}" not found in flowpanel.config.ts`);
  }

  const trimmed = sf.getFullText().replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: ${appDir}/admin/${resourceName}\n`;
}

/** Remove the `dashboard({ path: "<dashboardPath>", … })` call from a config. */
export function editConfigToCommentDashboard(
  source: string,
  dashboardPath: string,
  filename = "flowpanel.config.ts",
  appDir = "app",
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(filename, source);

  let removed = false;
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (callee.getText().trim() !== "dashboard") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first || !Node.isObjectLiteralExpression(first)) return;
    const pathProp = first.getProperty("path");
    if (!pathProp || !Node.isPropertyAssignment(pathProp)) return;
    const init = pathProp.getInitializer();
    if (!init) return;
    const initText = init.getText().trim();
    const stringMatch = /^["'`](.+)["'`]$/.exec(initText);
    if (!stringMatch) return;
    if (stringMatch[1] !== dashboardPath) return;
    replaceCallInArray(node);
    removed = true;
  });

  if (!removed) {
    throw new Error(
      `eject: dashboard with path "${dashboardPath}" not found in flowpanel.config.ts`,
    );
  }

  const slug = dashboardPath === "/" ? "" : dashboardPath;
  const trimmed = sf.getFullText().replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: ${appDir}/admin${slug}\n`;
}

function replaceCallInArray(call: import("ts-morph").CallExpression): void {
  const parent = call.getParent();
  if (parent && Node.isArrayLiteralExpression(parent)) {
    const elements = parent.getElements();
    const idx = elements.indexOf(call);
    if (idx >= 0) {
      parent.removeElement(idx);
    }
  } else {
    call.replaceWithText("undefined");
  }
}
