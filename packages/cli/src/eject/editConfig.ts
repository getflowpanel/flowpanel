import { Node, Project } from "ts-morph";

/**
 * Remove the `resource(<refMatchingName>, …)` call from a flowpanel.config.ts
 * source. Recognises two shapes:
 *   resource(schema.<name>, …)            // drizzle
 *   resource<...>("<name>", …)            // prisma
 *   resource<...>(`<name>`, …)            // template-string variant
 *
 * Adds a top-level `// ejected: app/admin/<name>` marker on a new line.
 *
 * `filename` lets the caller pin the in-memory source extension — pass
 * `flowpanel.config.tsx` when the host's config uses sidecar JSX, so ts-morph
 * parses JSX literals correctly.
 *
 * Throws if no matching call is found — the user passed a resource that
 * doesn't exist in this config.
 */
export function editConfigToCommentResource(
  source: string,
  resourceName: string,
  filename = "flowpanel.config.ts",
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
    // Strip type arguments from callee text (e.g. "resource" in resource<unknown>(...))
    const calleeText = callee.getText().trim();
    if (calleeText !== "resource") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const text = first.getText().trim();

    // drizzle: schema.users  or any.path.users
    const dotMatch = /\.([A-Za-z_][\w$]*)\s*$/.exec(text);
    if (dotMatch && dotMatch[1] === resourceName) {
      replaceCallInArray(node);
      removed = true;
      return;
    }
    // prisma: "users" or 'users' or `users`
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      replaceCallInArray(node);
      removed = true;
      return;
    }
    // bare identifier: just `users` (schema namespace import as `users`)
    if (text === resourceName) {
      replaceCallInArray(node);
      removed = true;
    }
  });

  if (!removed) {
    throw new Error(`eject: resource "${resourceName}" not found in flowpanel.config.ts`);
  }

  // Append a top-level marker line at the end of the file.
  const trimmed = sf.getFullText().replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: app/admin/${resourceName}\n`;
}

/**
 * Remove the `dashboard({ path: "<dashboardPath>", … })` call from a config.
 * Adds a top-level `// ejected: app/admin<dashboardPath>` marker comment.
 *
 * `filename` lets the caller pin the in-memory source extension — pass
 * `flowpanel.config.tsx` when the host's config uses sidecar JSX.
 *
 * Throws if no matching call is found.
 */
export function editConfigToCommentDashboard(
  source: string,
  dashboardPath: string,
  filename = "flowpanel.config.ts",
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
    // Find a `path: "<dashboardPath>"` property.
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
  return `${trimmed}\n\n// ejected: app/admin${slug}\n`;
}

function replaceCallInArray(call: import("ts-morph").CallExpression): void {
  const parent = call.getParent();
  if (parent && Node.isArrayLiteralExpression(parent)) {
    // Locate the index in the array and remove the element.
    const elements = parent.getElements();
    const idx = elements.findIndex((el) => el === call);
    if (idx >= 0) {
      parent.removeElement(idx);
    }
  } else {
    // Fall back to replacing the call with `undefined` if it isn't directly inside an array.
    call.replaceWithText("undefined");
  }
}
