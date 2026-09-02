import type { FieldDef, QueryContext, Scope } from "@flowpanel/kit";
import { type AnyColumn, eq } from "drizzle-orm";
import { isPublicSandboxId } from "./identity";

export function requireSandboxId(scope: Scope): string {
  const value = scope?.sandboxId;
  if (value === "local" || (typeof value === "string" && isPublicSandboxId(value))) return value;
  throw new Error("A valid demo sandbox scope is required for this operation");
}

export function sandboxScope(column: AnyColumn) {
  return (scope: Scope, query: unknown) =>
    (query as { where(condition: ReturnType<typeof eq>): unknown }).where(
      eq(column, requireSandboxId(scope)),
    );
}

export function sandboxField<Row extends Record<string, unknown>>(): FieldDef<Row> {
  return {
    name: "sandboxId" as keyof Row & string,
    type: "hidden",
    hidden: true,
    defaultValue: async (ctx: QueryContext) => requireSandboxId(ctx.scope),
  };
}

export function sandboxResourcePolicy(column: AnyColumn) {
  return {
    scope: sandboxScope(column),
    fieldAccess: {
      sandboxId: { read: false, write: false },
      seedKey: { read: false, write: false },
    },
  } as const;
}

export function sandboxImportConfig<Config>(config: Config, publicMode: boolean): Config | false {
  return publicMode ? false : config;
}
