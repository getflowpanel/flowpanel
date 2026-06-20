import type {
  FieldDef,
  ItemQueryContext,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  SelectOption,
} from "@flowpanel/core";
import { checkRequireRole, humanize, runWithRequestContext } from "@flowpanel/core";
import type { ResolvedField } from "@flowpanel/react";
import { roleAllows } from "./action-helpers.js";
import { scopeBinding } from "./scope-binding.js";

/** The declared field specs for a form mode. */
export function declaredFormFields(
  resource: ResourceConfig,
  mode: "create" | "update",
): FieldDef<Record<string, unknown>>[] | undefined {
  if (mode === "create") return resource.options.create?.fields;
  return resource.options.update?.fields ?? resource.options.create?.fields;
}

/** Evaluate a `boolean | (values) => boolean` field option server-side. */
function fieldFlag(
  flag: boolean | ((values: Partial<Record<string, unknown>>) => boolean) | undefined,
  values: Partial<Record<string, unknown>>,
): boolean {
  return typeof flag === "function" ? flag(values) : (flag ?? false);
}

function normalizeOptions(
  opts: ReadonlyArray<string> | SelectOption[],
): { label: string; value: string }[] {
  return opts.map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
  );
}

/** Resolve just the CURRENT value's label for a `reference` field — a single PK lookup, not a list. */
async function resolveReferenceCurrentOption(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  ref: { resource: string; labelField: string },
  currentValue: unknown,
): Promise<{ label: string; value: string }[]> {
  if (currentValue === null || currentValue === undefined || currentValue === "") return [];
  const target = config.resourcesByName.get(ref.resource);
  if (!target) return [];
  if (target.options.requireRole !== undefined) {
    try {
      checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
    } catch {
      return [];
    }
  }
  const pk = config.adapter.introspect(target.ref).primaryKey;
  const itemCtx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id: String(currentValue),
    ...scopeBinding(config, target, reqCtx),
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(target.ref, itemCtx),
  )) as Record<string, unknown> | null;
  if (!row) return [];
  return [{ value: String(row[pk]), label: String(row[ref.labelField] ?? row[pk]) }];
}

export async function resolveFormFields(
  config: ResolvedAdminConfig,
  fields: FieldDef<Record<string, unknown>>[],
  reqCtx: RequestContext,
  row?: Record<string, unknown>,
): Promise<ResolvedField[]> {
  const queryCtx: QueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
  };
  const values = row ?? {};
  const visible = fields.filter(
    (f) => roleAllows(f.requireRole, reqCtx) && !fieldFlag(f.hidden, values),
  );
  return Promise.all(
    visible.map(async (f): Promise<ResolvedField> => {
      const opts = f.options;
      let options: { label: string; value: string }[] | undefined;
      if (f.reference) {
        options = await resolveReferenceCurrentOption(config, reqCtx, f.reference, values[f.name]);
      } else if (typeof opts === "function") {
        const resolved = await runWithRequestContext(reqCtx, () => opts(queryCtx));
        options = normalizeOptions(resolved);
      } else if (Array.isArray(opts)) {
        options = normalizeOptions(opts);
      }
      let defaultValue: unknown;
      if (row === undefined && f.defaultValue !== undefined) {
        defaultValue =
          typeof f.defaultValue === "function"
            ? await runWithRequestContext(reqCtx, () =>
                (f.defaultValue as (ctx: QueryContext) => Promise<unknown>)(queryCtx),
              )
            : f.defaultValue;
      }
      return {
        name: f.name,
        label: f.label ?? humanize(f.name),
        type: f.type ?? (f.reference ? "reference" : "text"),
        ...(f.help ? { help: f.help } : {}),
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.required ? { required: f.required } : {}),
        ...(fieldFlag(f.readOnly, values) ? { readOnly: true } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(f.span ? { span: f.span } : {}),
        ...(f.group ? { group: f.group } : {}),
        ...(options ? { options } : {}),
      };
    }),
  );
}
