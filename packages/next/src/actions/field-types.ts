import type { FieldDef, FieldType, ResolvedLabels } from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core";
import { SERVER_LABELS, type ServerFormLabel } from "@flowpanel/core/internal";

type Field = FieldDef<Record<string, unknown>>;
type Message = "invalidNumber" | "invalidDate" | ServerFormLabel;

// The pattern browsers apply to <input type="email">, so the server accepts what the form does.
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/;

const isText = (value: unknown): value is string => typeof value === "string";

const CHECKS: Partial<Record<FieldType, { valid: (value: unknown) => boolean; message: Message }>> =
  {
    email: { valid: (v) => isText(v) && EMAIL.test(v.trim()), message: "invalidEmail" },
    url: {
      valid: (v) => isText(v) && /^https?:\/\//i.test(v.trim()) && URL.canParse(v.trim()),
      message: "invalidUrl",
    },
    color: { valid: (v) => isText(v) && COLOR.test(v.trim()), message: "invalidColor" },
    time: {
      valid: (v) => v instanceof Date || (isText(v) && TIME.test(v.trim())),
      message: "invalidTime",
    },
    number: {
      valid: (v) =>
        typeof v === "bigint" ||
        (typeof v === "number" && Number.isFinite(v)) ||
        (isText(v) && v.trim() !== "" && Number.isFinite(Number(v))),
      message: "invalidNumber",
    },
    date: { valid: isDate, message: "invalidDate" },
    datetime: { valid: isDate, message: "invalidDate" },
  };

function isDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return isText(value) && !Number.isNaN(Date.parse(value));
}

const serverOnly = (key: Message): key is ServerFormLabel => Object.hasOwn(SERVER_LABELS.form, key);

function messageOf(labels: ResolvedLabels, key: Message): string {
  const own = labels.form[key];
  if (own !== undefined) return own;
  return serverOnly(key) ? SERVER_LABELS.form[key] : key;
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (isText(value) && value.trim() === "");

/** Values that do not fit their field's declared `type`; a value the row already holds is kept. */
export function typedValueErrors(
  fields: readonly Field[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  labels: ResolvedLabels,
  labelOf: (name: string) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields ?? []) {
    const check = field.type === undefined ? undefined : CHECKS[field.type];
    if (!check || !Object.hasOwn(values, field.name)) continue;
    const value = values[field.name];
    if (isEmpty(value) || check.valid(value)) continue;
    if (current !== null && Object.is(current[field.name], value)) continue;
    const template = messageOf(labels, check.message);
    out[field.name] = formatLabel(template, { label: labelOf(field.name) });
  }
  return out;
}
