import type {
  FieldDef,
  QueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { accessAllows, humanize, runWithRequestContext } from "@flowpanel/core";
import type { ResolvedField } from "@flowpanel/react";
import { readRelatedRows } from "./require-authorized";
import { toWireOptions } from "./select-options";

/** The declared field specs for a form mode. */
export function declaredFormFields(
  resource: ResourceConfig,
  mode: "create" | "update",
): FieldDef<Record<string, unknown>>[] | undefined {
  if (mode === "create") return resource.options.create?.fields;
  return resource.options.update?.fields ?? resource.options.create?.fields;
}

/** Evaluate a `boolean | (values) => boolean` field option server-side. */
export function fieldFlag(
  flag: boolean | ((values: Partial<Record<string, unknown>>) => boolean) | undefined,
  values: Partial<Record<string, unknown>>,
): boolean {
  return typeof flag === "function" ? flag(values) : (flag ?? false);
}

/** Fields `fieldAccess.write` keeps this caller from writing, judged as the form renders them: before any input. */
export async function deniedFieldWrites(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  current: Record<string, unknown> | null,
): Promise<ReadonlySet<string>> {
  const denied = new Set<string>();
  const context = { ...reqCtx, current, input: {} };
  for (const [name, policy] of Object.entries(resource.options.fieldAccess ?? {})) {
    const write = policy?.write;
    if (write === undefined) continue;
    const allowed =
      typeof write === "function"
        ? Boolean(await write(context))
        : await accessAllows(write, context);
    if (!allowed) denied.add(name);
  }
  return denied;
}

/** Denied fields the caller may not read either: a form leaves them out instead of showing an empty locked control. */
export async function hiddenFormFields(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  denied: ReadonlySet<string>,
): Promise<ReadonlySet<string>> {
  const hidden = new Set<string>();
  const policies = new Map(Object.entries(resource.options.fieldAccess ?? {}));
  for (const name of denied) {
    const policy = policies.get(name);
    const unreadable =
      policy?.sensitive === true ||
      (policy?.read !== undefined && !(await accessAllows(policy.read, reqCtx)));
    if (unreadable) hidden.add(name);
  }
  return hidden;
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
  const pk = config.adapter.introspect(target.ref).primaryKey;
  const rows = await readRelatedRows(config, target, reqCtx, {
    filters: { [pk]: String(currentValue) },
    pageSize: 1,
    extraFields: [pk, ref.labelField],
  });
  const row = rows?.[0];
  if (!row) return [];
  return [{ value: String(row[pk]), label: String(row[ref.labelField] ?? row[pk]) }];
}

export async function resolveFormFields(
  config: ResolvedAdminConfig,
  fields: FieldDef<Record<string, unknown>>[],
  reqCtx: RequestContext,
  row?: Record<string, unknown>,
  denied: ReadonlySet<string> = new Set(),
  hidden: ReadonlySet<string> = new Set(),
): Promise<ResolvedField[]> {
  const queryCtx: QueryContext = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
  };
  const values = row ?? {};
  const visible = fields.filter((f) => !hidden.has(f.name) && !fieldFlag(f.hidden, values));
  return Promise.all(
    visible.map(async (f): Promise<ResolvedField> => {
      const opts = f.options;
      let options: { label: string; value: string }[] | undefined;
      if (f.reference) {
        options = await resolveReferenceCurrentOption(config, reqCtx, f.reference, values[f.name]);
      } else if (typeof opts === "function") {
        const resolved = await runWithRequestContext(reqCtx, () => opts(queryCtx));
        options = toWireOptions(resolved);
      } else if (Array.isArray(opts)) {
        options = toWireOptions(opts);
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
        ...(fieldFlag(f.readOnly, values) || denied.has(f.name) ? { readOnly: true } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(f.span ? { span: f.span } : {}),
        ...(f.group ? { group: f.group } : {}),
        ...(options ? { options } : {}),
      };
    }),
  );
}
