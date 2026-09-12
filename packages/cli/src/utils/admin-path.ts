import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Node, Project } from "ts-morph";
import { resolveProjectModule } from "./module-path";

/** Where `flowpanel init` mounts the route handlers when the config says nothing. */
export const DEFAULT_API_PATH = "/api/flowpanel";

/** Static URL segments only: no route syntax, traversal, query or encoded separators. */
export function normalizeAdminPath(input: string): string {
  const value = input.replace(/\/$/, "");
  const segments = (value.startsWith("/") ? value.slice(1) : value).split("/");
  if (!segments.length || segments.some((s) => !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(s))) {
    throw new Error("Admin path must contain static segments, for example /admin or /ops/admin.");
  }
  return `/${segments.join("/")}`;
}

/** Own only this static branch: Next gives it precedence over sibling dynamic fallbacks. */
function overlapsMount(route: string[], mount: string[]): boolean {
  for (const [i, segment] of route.entries()) {
    if (i >= mount.length) return true;
    if (segment !== mount[i]) return false;
  }
  return route.length >= mount.length;
}

/** Interception counts URL segments, excluding route groups and parallel slots. */
function routeSegments(parent: string[], name: string): string[] {
  if (/^\([^.)][^/]*\)$/.test(name) || name.startsWith("@")) return parent;
  const segments = [...parent];
  let rest = name;
  while (rest.startsWith("(.)") || rest.startsWith("(..)") || rest.startsWith("(...)")) {
    if (rest.startsWith("(...)")) {
      segments.length = 0;
      rest = rest.slice(5);
    } else if (rest.startsWith("(..)")) {
      segments.pop();
      rest = rest.slice(4);
    } else {
      rest = rest.slice(3);
    }
  }
  return [...segments, rest];
}

export async function findAdminRouteConflicts(
  cwd: string,
  appDir: string,
  mount: string,
  ignoreFile?: string,
): Promise<string[]> {
  const target = normalizeAdminPath(mount).slice(1).split("/");
  const conflicts: string[] = [];
  async function walk(dir: string, segments: string[]): Promise<void> {
    const entries = await fs.readdir(path.join(cwd, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        await walk(rel, routeSegments(segments, entry.name));
      } else if (/^(page|route)\.[cm]?[jt]sx?$/.test(entry.name) && rel !== ignoreFile) {
        if (overlapsMount(segments, target)) conflicts.push(rel);
      }
    }
  }
  await walk(appDir, []);
  return conflicts.sort();
}

export type AdminMount =
  | {
      path: string;
      /** The configured `paths.api`, or `null` when it is declared but not static. */
      api: string | null;
      error?: never;
    }
  | { path?: never; api?: never; error: string };

/** Route mounts are static URL prefixes; the same rule as the admin path. */
export function normalizeApiPath(input: string): string {
  return normalizeAdminPath(input);
}

/** Read literal mount declarations without importing DB/auth or executing user config. */
export async function readAdminMount(cwd: string): Promise<AdminMount> {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const visited = new Set<string>();
  async function read(file: string, exportName = "default"): Promise<AdminMount> {
    const unresolved = (): AdminMount => ({
      error: `${path.relative(cwd, file)}: dynamic or unresolved admin config; pass --path with its resolved admin URL.`,
    });
    const key = `${file}#${exportName}`;
    if (visited.has(key)) return unresolved();
    visited.add(key);
    const source =
      project.getSourceFile(file) ??
      project.createSourceFile(file, await fs.readFile(file, "utf8"));
    const namedVariable = source.getVariableDeclaration(exportName);
    let config: Node | undefined =
      exportName === "default"
        ? source.getExportAssignments()[0]?.getExpression()
        : namedVariable?.getVariableStatement()?.hasExportKeyword()
          ? namedVariable.getInitializer()
          : undefined;
    if (!config) {
      const declaration = source
        .getExportDeclarations()
        .find((d) =>
          d
            .getNamedExports()
            .some((e) => (e.getAliasNode()?.getText() ?? e.getName()) === exportName),
        );
      const specifier = declaration?.getModuleSpecifierValue();
      if (!specifier) return unresolved();
      const target = await resolveProjectModule(cwd, specifier, file);
      const exported = declaration
        ?.getNamedExports()
        .find((e) => (e.getAliasNode()?.getText() ?? e.getName()) === exportName);
      return target && exported ? read(target, exported.getName()) : unresolved();
    }
    if (Node.isIdentifier(config))
      config = source.getVariableDeclaration(config.getText())?.getInitializer();
    if (Node.isCallExpression(config)) config = config.getArguments()[0];
    if (!Node.isObjectLiteralExpression(config)) {
      return unresolved();
    }
    if (config.getProperties().some(Node.isSpreadAssignment)) return unresolved();
    const paths = config.getProperty("paths");
    const legacy = config.getProperty("basePath");
    let value: Node | undefined;
    let apiValue: Node | undefined;
    let apiDeclared = false;
    if (paths) {
      const init = Node.isPropertyAssignment(paths) ? paths.getInitializer() : undefined;
      if (!Node.isObjectLiteralExpression(init)) {
        return { error: `${file}: dynamic paths; pass --path with the resolved admin URL.` };
      }
      if (init.getProperties().some(Node.isSpreadAssignment)) return unresolved();
      const admin = init.getProperty("admin");
      value = admin && Node.isPropertyAssignment(admin) ? admin.getInitializer() : admin;
      const api = init.getProperty("api");
      apiDeclared = api !== undefined;
      apiValue = api && Node.isPropertyAssignment(api) ? api.getInitializer() : api;
    }
    if (!value && legacy) {
      value = Node.isPropertyAssignment(legacy) ? legacy.getInitializer() : legacy;
    }
    if (value && !Node.isStringLiteral(value) && !Node.isNoSubstitutionTemplateLiteral(value)) {
      return { error: `${file}: dynamic admin path; pass --path with the resolved admin URL.` };
    }
    // A declared but non-literal `paths.api` is unknown, not the default: repairing
    // the default would write routes the config never points at.
    const staticApi =
      apiValue && (Node.isStringLiteral(apiValue) || Node.isNoSubstitutionTemplateLiteral(apiValue))
        ? apiValue.getLiteralText()
        : null;
    try {
      return {
        path: value ? normalizeAdminPath(value.getLiteralText()) : "/admin",
        api: apiDeclared
          ? staticApi === null
            ? null
            : normalizeApiPath(staticApi)
          : DEFAULT_API_PATH,
      };
    } catch (e) {
      return { error: `${file}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const root = await resolveProjectModule(cwd, "./flowpanel.config");
  return root ? read(root) : { path: "/admin", api: DEFAULT_API_PATH };
}
