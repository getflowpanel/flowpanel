import { FlowpanelFieldAccessError, FlowpanelUnknownFieldError } from "../types/error";
import type { AccessContext, FieldAccessMap, FieldWriteContext } from "../types/policy";
import { accessAllows } from "./access";

export async function filterReadableProjection<Row>(
  projection: readonly (keyof Row & string)[],
  policies: FieldAccessMap<Row> | undefined,
  context: AccessContext,
): Promise<(keyof Row & string)[]> {
  const readable: (keyof Row & string)[] = [];
  for (const field of projection) {
    const policy = policies?.[field];
    if (policy?.sensitive) continue;
    if (await accessAllows(policy?.read, context)) readable.push(field);
  }
  return readable;
}

export interface WritableInputOptions<Row> {
  declaredFields: readonly (keyof Row & string)[];
  policies?: FieldAccessMap<Row>;
  input: Record<string, unknown>;
  context: FieldWriteContext<Row>;
}

function isWritePredicate<Row>(
  value: NonNullable<FieldAccessMap<Row>[keyof Row & string]>["write"] | undefined,
): value is (context: FieldWriteContext<Row>) => boolean | Promise<boolean> {
  return typeof value === "function";
}

/** Validate the submitted allowlist and policies without ever silently dropping a key. */
export async function assertWritableInput<Row>({
  declaredFields,
  policies,
  input,
  context,
}: WritableInputOptions<Row>): Promise<Partial<Row>> {
  const declared = new Set<string>(declaredFields);
  const submitted = input as Record<string, unknown>;

  for (const field of Object.keys(submitted)) {
    if (!declared.has(field)) throw new FlowpanelUnknownFieldError(field);
  }

  for (const field of Object.keys(submitted) as (keyof Row & string)[]) {
    const write = policies?.[field]?.write;
    let allowed = true;
    if (isWritePredicate<Row>(write)) allowed = Boolean(await write(context));
    else allowed = await accessAllows(write, context);
    if (!allowed) throw new FlowpanelFieldAccessError(field);
  }

  return { ...input } as Partial<Row>;
}
