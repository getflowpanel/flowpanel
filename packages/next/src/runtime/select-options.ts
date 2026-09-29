import type { SelectOption } from "@flowpanel/core";

/** Stringifies declared `select`/`multiselect`/`radio` choices for the wire; `String(value)` is the sole contract clients round-trip. */
export function toWireOptions(
  options: ReadonlyArray<string | SelectOption>,
): { label: string; value: string }[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
  );
}
