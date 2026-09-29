type Named = { key?: unknown; requireRole?: unknown };

function actionsOf(list: unknown): Named[] {
  return Array.isArray(list) ? (list.filter((a) => a && typeof a === "object") as Named[]) : [];
}

function reject(where: string): never {
  throw new Error(
    `${where} sets requireRole, which it does not read. Gate it with access instead.`,
  );
}

/** Fails a resource or action that still gates itself with `requireRole`, which would leave it open. */
export function assertNoRequireRole(name: string, options: Record<string, unknown>): void {
  if ("requireRole" in options) reject(`resource "${name}"`);
  for (const part of ["detail", "drawer"] as const) {
    const section = options[part] as Record<string, unknown> | undefined;
    if (section && "header" in section) {
      throw new Error(`resource "${name}" ${part}.header is not read. Name it ${part}.title.`);
    }
  }
  const drawer = options.drawer as { actions?: unknown } | undefined;
  for (const [kind, list] of [
    ["action", options.actions],
    ["bulk action", options.bulkActions],
    ["drawer action", drawer?.actions],
  ] as const) {
    for (const action of actionsOf(list)) {
      if ("requireRole" in action) reject(`resource "${name}" ${kind} "${String(action.key)}"`);
    }
  }
}

/** Same check for a dashboard's actions. */
export function assertNoDashboardActionRequireRole(path: string, actions: unknown): void {
  for (const action of actionsOf(actions)) {
    if ("requireRole" in action) reject(`dashboard "${path}" action "${String(action.key)}"`);
  }
}

/** Fails a config that still mounts the admin with `basePath`, which would send every link to the default mount. */
export function assertNoBasePath(config: Record<string, unknown>): void {
  if ("basePath" in config)
    throw new Error("basePath is not read. Mount the admin with paths.admin.");
}
