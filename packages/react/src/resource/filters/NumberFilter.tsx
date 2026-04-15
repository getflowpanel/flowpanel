import type { SerializedFilter } from "@flowpanel/core";
import { Input } from "../../ui/input";

interface NumberRangeValue {
  min?: number;
  max?: number;
}

export function NumberFilter({
  filter,
  value,
  onChange,
}: {
  filter: SerializedFilter;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const isRange = filter.mode === "range";

  if (isRange) {
    const range = (value as NumberRangeValue | undefined) ?? {};
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="h-8 text-sm"
          placeholder="Min"
          value={range.min ?? ""}
          onChange={(e) => {
            const min = e.target.value === "" ? undefined : Number(e.target.value);
            onChange({ ...range, min });
          }}
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="number"
          className="h-8 text-sm"
          placeholder="Max"
          value={range.max ?? ""}
          onChange={(e) => {
            const max = e.target.value === "" ? undefined : Number(e.target.value);
            onChange({ ...range, max });
          }}
        />
      </div>
    );
  }

  return (
    <Input
      type="number"
      className="h-8 text-sm"
      placeholder={filter.label}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}
