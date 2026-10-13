/** An instant a card shows the way a datetime column does: in the viewer's zone when the admin sets none. */
export interface CardDate {
  kind: "date";
  iso: string;
}

export function isCardDate(value: unknown): value is CardDate {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "date" &&
    typeof (value as { iso?: unknown }).iso === "string"
  );
}
