import type { ResolvedLabels } from "./defaults";

type ErrorKey = keyof ResolvedLabels["errors"];

const LABEL_BY_CODE = new Map<string, ErrorKey>([
  ["not_found", "notFound"],
  ["forbidden", "forbidden"],
  ["field_forbidden", "forbidden"],
  ["unauthenticated", "signedOut"],
  ["operation_disabled", "readOnly"],
  ["rate_limited", "rateLimited"],
  ["payload_too_large", "tooLarge"],
]);

/** The reader's words for a write the kit refused with `code`; any other failure keeps its own message. */
export function failureMessage(
  errors: ResolvedLabels["errors"],
  code: unknown,
  message: string | undefined,
): string | undefined {
  const key = typeof code === "string" ? LABEL_BY_CODE.get(code) : undefined;
  return key ? errors[key] : message;
}
