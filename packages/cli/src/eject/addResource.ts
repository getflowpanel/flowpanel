import { Node, Project } from "ts-morph";

/**
 * Insert a `resource(...)` call into the `resources` array of a
 * flowpanel.config.ts source string.
 *
 * Supported kinds:
 *   drizzle (default) → resource(schema.<resourceName>, { columns: ["id"] })
 *   prisma            → resource<unknown>("<resourceName>", { columns: ["id"] })
 *
 * If `options.table` is supplied it is used verbatim as the first argument
 * instead of the auto-generated `schema.<resourceName>`.
 *
 * `options.filename` lets the caller pin the in-memory source extension — pass
 * `flowpanel.config.tsx` when the host's config file uses sidecar JSX, so
 * ts-morph parses JSX literals correctly.
 *
 * Throws if a matching resource already exists.
 */
export function editConfigToAddResource(
  source: string,
  resourceName: string,
  options?: { table?: string; kind?: "drizzle" | "prisma"; filename?: string },
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(options?.filename ?? "flowpanel.config.ts", source);

  // ── Duplicate-check ──────────────────────────────────────────────────────
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const calleeText = node.getExpression().getText().trim();
    if (calleeText !== "resource") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const text = first.getText().trim();

    const dotMatch = /\.([A-Za-z_][\w$]*)\s*$/.exec(text);
    if (dotMatch && dotMatch[1] === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
    if (text === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
  });

  // ── Build the new resource call text ────────────────────────────────────
  const kind = options?.kind ?? "drizzle";
  let firstArg: string;
  if (options?.table) {
    firstArg = options.table;
  } else if (kind === "prisma") {
    firstArg = `"${resourceName}"`;
  } else {
    firstArg = `schema.${resourceName}`;
  }
  const typeParam = kind === "prisma" ? "<unknown>" : "";
  const callText = `resource${typeParam}(${firstArg}, { columns: ["id"] })`;

  // ── Find / create the `resources` array ─────────────────────────────────
  let inserted = false;

  sf.forEachDescendant((node) => {
    if (inserted) return;
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression().getText().trim();
    if (callee !== "defineAdmin") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first || !Node.isObjectLiteralExpression(first)) return;

    const resourcesProp = first.getProperty("resources");
    if (resourcesProp && Node.isPropertyAssignment(resourcesProp)) {
      const init = resourcesProp.getInitializer();
      if (init && Node.isArrayLiteralExpression(init)) {
        init.addElement(callText);
        inserted = true;
      }
    } else {
      // No `resources` property — add it.
      first.addPropertyAssignment({
        name: "resources",
        initializer: `[\n    ${callText},\n  ]`,
      });
      inserted = true;
    }
  });

  if (!inserted) {
    throw new Error("new: could not find a defineAdmin({ ... }) call in flowpanel.config.ts");
  }

  return sf.getFullText();
}
