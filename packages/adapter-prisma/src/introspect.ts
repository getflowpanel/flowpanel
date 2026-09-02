import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";

export interface PrismaDmmfField {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isId: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isList: boolean;
  hasDefault: boolean;
}

export interface PrismaDmmfEnum {
  name: string;
  values: Array<{ name: string }>;
}

export interface PrismaDmmfModel {
  name: string;
  fields: PrismaDmmfField[];
}

export interface PrismaDmmf {
  datamodel: {
    models: PrismaDmmfModel[];
    enums: PrismaDmmfEnum[];
  };
}

const memo = new WeakMap<PrismaDmmf, Map<string, ResourceIntrospection>>();

export function introspect(modelName: string, dmmf: PrismaDmmf): ResourceIntrospection {
  let byModel = memo.get(dmmf);
  if (!byModel) {
    byModel = new Map();
    memo.set(dmmf, byModel);
  }
  const cached = byModel.get(modelName);
  if (cached) return cached;

  const model = dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) {
    const available = dmmf.datamodel.models.map((m) => m.name).join(", ");
    throw new Error(
      `prismaAdapter: model "${modelName}" not found in DMMF. Available models: ${available}`,
    );
  }

  const columns: ColumnMeta[] = [];
  let primaryKey = "id";

  for (const field of model.fields) {
    if (field.kind === "object") continue;

    const meta: ColumnMeta = {
      name: field.name,
      type: mapType(field, dmmf),
      nullable: !field.isRequired,
      unique: field.isUnique,
      primaryKey: field.isId,
      readable: true,
      // An id with a default (autoincrement/cuid/uuid) is database-generated;
      // a non-id default stays writable.
      writableOnCreate: !(field.isId && field.hasDefault),
      writableOnUpdate: !field.isId,
      generated: field.isId && field.hasDefault,
    };

    if (field.kind === "enum") {
      const enumDef = dmmf.datamodel.enums.find((e) => e.name === field.type);
      if (enumDef) {
        meta.enumValues = enumDef.values.map((v) => v.name);
      }
    }

    if (field.isId) primaryKey = field.name;

    columns.push(meta);
  }

  const result = freeze({ name: model.name, columns, primaryKey });
  byModel.set(modelName, result);
  return result;
}

// Memoized: one object is shared by every caller, so it must not be mutable.
function freeze(intro: ResourceIntrospection): ResourceIntrospection {
  for (const column of intro.columns) Object.freeze(column);
  Object.freeze(intro.columns);
  return Object.freeze(intro);
}

function mapType(field: PrismaDmmfField, _dmmf: PrismaDmmf): ColumnMeta["type"] {
  if (field.kind === "enum") return "enum";
  if (field.isList) return "array";

  switch (field.type) {
    case "Boolean":
      return "boolean";
    case "Int":
    case "BigInt":
    case "Float":
    case "Decimal":
      return "number";
    case "DateTime":
      return "date";
    case "Json":
      return "json";
    default:
      return "string";
  }
}
