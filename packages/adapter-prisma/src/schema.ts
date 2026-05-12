import { z } from "zod";
import type { PrismaDmmf, PrismaDmmfField } from "./introspect.js";

export { type PrismaDmmf } from "./introspect.js";

function fieldToZod(field: PrismaDmmfField, dmmf: PrismaDmmf): z.ZodTypeAny {
  if (field.isList) return z.array(z.unknown());

  if (field.kind === "enum") {
    const enumDef = dmmf.datamodel.enums.find((e) => e.name === field.type);
    const values = enumDef ? enumDef.values.map((v) => v.name) : [];
    if (values.length === 0) return z.string();
    return z.enum(values as [string, ...string[]]);
  }

  switch (field.type) {
    case "Boolean":
      return z.boolean();
    case "Int":
    case "BigInt":
    case "Float":
    case "Decimal":
      return z.number();
    case "DateTime":
      return z.coerce.date();
    case "Json":
      return z.unknown();
    default:
      return z.string();
  }
}

export function inferSchema(
  modelName: string,
  dmmf: PrismaDmmf,
): { create: z.ZodTypeAny; update: z.ZodTypeAny; select: z.ZodTypeAny } {
  const model = dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) {
    const available = dmmf.datamodel.models.map((m) => m.name).join(", ");
    throw new Error(
      `prismaAdapter: model "${modelName}" not found in DMMF. Available models: ${available}`,
    );
  }

  const scalarFields = model.fields.filter((f) => f.kind !== "object");

  // create: required fields required, optional optional — but omit id field
  const createShape: Record<string, z.ZodTypeAny> = {};
  const updateShape: Record<string, z.ZodTypeAny> = {};
  const selectShape: Record<string, z.ZodTypeAny> = {};

  for (const field of scalarFields) {
    const base = fieldToZod(field, dmmf);
    const nullable = !field.isRequired;

    selectShape[field.name] = nullable ? base.optional().nullable() : base;

    if (!field.isId) {
      createShape[field.name] = nullable ? base.optional().nullable() : base;
      updateShape[field.name] = nullable ? base.optional().nullable() : base;
    }
  }

  return {
    create: z.object(createShape),
    update: z.object(updateShape).partial(),
    select: z.object(selectShape),
  };
}
