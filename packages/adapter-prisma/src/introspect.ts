import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";

// Minimal DMMF types we need — avoids hard dep on @prisma/client at compile time
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

export function introspect(modelName: string, dmmf: PrismaDmmf): ResourceIntrospection {
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
    // Skip relation fields
    if (field.kind === "object") continue;

    const meta: ColumnMeta = {
      name: field.name,
      type: mapType(field, dmmf),
      nullable: !field.isRequired,
      unique: field.isUnique,
      primaryKey: field.isId,
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

  return { name: model.name, columns, primaryKey };
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
