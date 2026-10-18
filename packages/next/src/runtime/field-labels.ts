import type { FieldDef, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { humanize, humanizeAmount, humanizeReference } from "@flowpanel/core";
import { SERVER_LABELS } from "@flowpanel/core/internal";
import { columnDefs } from "./column-defs";
import { formFieldsOf } from "./form-fields-of";

type Field = FieldDef<Record<string, unknown>>;
type FieldList = ReadonlyArray<unknown> | "*" | undefined;

function definedFields(list: FieldList): Field[] {
  if (list === undefined || list === "*") return [];
  return list.filter((entry): entry is Field => typeof entry === "object" && entry !== null);
}

/** Every field def a resource's drawer and record page declare, drawer first. */
function viewFields(resource: ResourceConfig): Field[] {
  const { detail, drawer } = resource.options;
  return [
    ...definedFields(drawer?.fields),
    ...(drawer?.tabs ?? []).flatMap((tab) => definedFields("fields" in tab ? tab.fields : [])),
    ...definedFields(detail?.fields),
    ...(detail?.tabs ?? []).flatMap((tab) => [
      ...definedFields(tab.fields),
      ...(tab.sections ?? []).flatMap((section) => definedFields(section.fields)),
    ]),
  ];
}

type Kind = "reference" | "money";

function kindOf(field: Field): Kind | undefined {
  if (field.reference !== undefined || field.type === "reference") return "reference";
  return field.type === "money" ? "money" : undefined;
}

/** The admin's `labels.fields`: names for fields nothing else labels, such as `createdAt`, in its language. */
export function namedFields(
  config: Pick<ResolvedAdminConfig, "labels">,
): Readonly<Record<string, string>> {
  return config.labels?.fields ?? SERVER_LABELS.fields;
}

/** The one label a field shows on every surface: its own, then a form's, record's or drawer's, then its column's, then `named`, then its name humanized. */
export function fieldLabels(
  resource: ResourceConfig | undefined,
  fields: readonly Field[] = [],
  named: Readonly<Record<string, string>> = {},
): (name: string) => string {
  const labels = new Map<string, string>();
  const kinds = new Map<string, Kind>();
  for (const column of resource ? columnDefs(resource) : []) {
    if (!column.field) continue;
    if (column.label) labels.set(column.field, column.label);
    if (column.reference) kinds.set(column.field, "reference");
    else if (
      column.format === "money" ||
      (typeof column.format === "object" && column.format.kind === "money")
    ) {
      kinds.set(column.field, "money");
    }
  }
  const declared = resource ? [...viewFields(resource), ...formFieldsOf(resource)] : [];
  for (const field of declared) {
    if (field.label) labels.set(field.name, field.label);
    const kind = kindOf(field);
    if (kind) kinds.set(field.name, kind);
  }
  for (const field of fields) {
    if (field.label) labels.set(field.name, field.label);
    const kind = kindOf(field);
    if (kind) kinds.set(field.name, kind);
  }
  return (name) => {
    const label = labels.get(name) ?? (Object.hasOwn(named, name) ? named[name] : undefined);
    if (label !== undefined) return label;
    const kind = kinds.get(name);
    if (kind === "reference") return humanizeReference(name);
    return kind === "money" ? humanizeAmount(name) : humanize(name);
  };
}
