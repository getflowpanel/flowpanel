import type { SelectOption } from "@flowpanel/core";

/**
 * Stringify declared `select` / `multiselect` / `radio` choices for the wire.
 * `String(value)` is the contract clients round-trip back through filters and
 * form submissions, so it lives here and nowhere else.
 */
export function toWireOptions(
  options: ReadonlyArray<string | SelectOption>,
): { label: string; value: string }[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
  );
}
