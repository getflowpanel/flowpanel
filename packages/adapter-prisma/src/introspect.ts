import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";

export interface PrismaDmmfField {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isId: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isList: boolean;
  /** Set for `@default(...)`, including `autoincrement()`, `uuid()`, `cuid()` and `now()`. */
  hasDefaultValue: boolean;
  /** Set for `@updatedAt`; Prisma fills the value on every write. */
  isUpdatedAt?: boolean;
  isGenerated?: boolean;
  /** The `@db` type and its arguments, e.g. `["Decimal", ["10", "2"]]`. */
  nativeType?: readonly [string, readonly string[]] | null;
}

export interface PrismaDmmfEnum {
  name: string;
  values: Array<{ name: string }>;
}

export interface PrismaDmmfModel {
  name: string;
  fields: PrismaDmmfField[];
  /** `@@id([...])`; `null` or absent for a single `@id`. */
  primaryKey?: { fields: readonly string[] } | null;
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
      writableOnCreate: !(field.isId && fillsItself(field)),
      writableOnUpdate: !field.isId,
      generated: field.isId && fillsItself(field),
      hasDefault: fillsItself(field),
    };

    if (meta.type === "number") meta.integer = field.type === "Int" || field.type === "BigInt";

    if (field.kind === "enum") {
      const enumDef = dmmf.datamodel.enums.find((e) => e.name === field.type);
      if (enumDef) {
        meta.enumValues = enumDef.values.map((v) => v.name);
      }
    }

    if (field.isId) primaryKey = field.name;

    columns.push(meta);
  }

  const keyColumns = model.primaryKey?.fields;
  const result = freeze({
    name: model.name,
    columns,
    primaryKey,
    ...(keyColumns && keyColumns.length > 0 ? { keyColumns: [...keyColumns] } : {}),
  });
  byModel.set(modelName, result);
  return result;
}

/** Prisma or the database supplies the value when a create leaves it out. */
export function fillsItself(field: PrismaDmmfField): boolean {
  return field.hasDefaultValue || field.isUpdatedAt === true || field.isGenerated === true;
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
