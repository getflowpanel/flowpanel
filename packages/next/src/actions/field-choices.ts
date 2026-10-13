import type {
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import { formatLabel, humanize, runWithRequestContext } from "@flowpanel/core";
import { requestQueryContext } from "../runtime/query-context";
import { readRelatedRows } from "../runtime/require-authorized";
import { columnReferences } from "../runtime/resolve-form-fields";
import { toWireOptions } from "../runtime/select-options";

type Field = FieldDef<Record<string, unknown>>;
type Reference = { resource: string; labelField: string };

const CHOICE_TYPES = new Set(["select", "radio", "multiselect"]);
/** Filter values that mean "is null" or "is not null" rather than an id. */
const FILTER_SENTINELS = new Set(["__null__", "__notnull__"]);

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/** Items this write adds: a value the row already holds is kept, even when no longer offered. */
function addedItems(value: unknown, current: unknown): string[] {
  const kept = new Set(
    asList(current)
      .filter((item) => !isBlank(item))
      .map(String),
  );
  return asList(value)
    .filter((item) => !isBlank(item))
    .map(String)
    .filter((item) => !kept.has(item));
}

async function offeredValues(field: Field, reqCtx: RequestContext): Promise<Set<string> | null> {
  const options = field.options;
  if (!CHOICE_TYPES.has(field.type ?? "") || options === undefined) return null;
  const resolved =
    typeof options === "function"
      ? await runWithRequestContext(reqCtx, () => options(requestQueryContext(reqCtx)))
      : options;
  return new Set(toWireOptions(resolved).map((option) => option.value));
}

/** The caller can read the target row, tenant scope included; a hidden row reads as missing. */
async function referenceReadable(
  config: ResolvedAdminConfig,
  reference: Reference,
  value: string,
  reqCtx: RequestContext,
): Promise<boolean> {
  const target = config.resourcesByName.get(reference.resource);
  if (!target || FILTER_SENTINELS.has(value)) return false;
  const pk = config.adapter.introspect(target.ref).primaryKey;
  const rows = await readRelatedRows(config, target, reqCtx, {
    filters: { [pk]: value },
    pageSize: 1,
    extraFields: [pk],
  });
  return (rows?.length ?? 0) > 0;
}

/** Choices and references the form never offered this caller; a value the row already holds is kept. */
export async function choiceErrors(
  config: ResolvedAdminConfig,
  resource: ResourceConfig | undefined,
  fields: Field[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  reqCtx: RequestContext,
  labels: ResolvedLabels,
): Promise<Record<string, string> | null> {
  const declared = new Map((fields ?? []).map((field) => [field.name, field]));
  const columns = resource ? columnReferences(resource) : new Map();
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    const added = addedItems(value, current?.[name]);
    if (added.length === 0) continue;
    const field = declared.get(name);
    const column = columns.get(name);
    const label = field?.label ?? column?.label ?? humanize(name);
    const reference = field?.reference ?? column?.reference;
    if (reference) {
      const readable = await Promise.all(
        added.map((id) => referenceReadable(config, reference, id, reqCtx)),
      );
      if (readable.includes(false)) {
        out[name] = formatLabel(labels.form.missingReference, { label });
      }
      continue;
    }
    const offered = field ? await offeredValues(field, reqCtx) : null;
    if (offered === null) continue;
    if (added.some((item) => !offered.has(item))) {
      out[name] = formatLabel(labels.form.invalidOption, { label });
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
