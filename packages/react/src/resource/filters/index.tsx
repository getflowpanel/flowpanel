import type { FilterMode, SerializedFilter } from "@flowpanel/core";
import { BooleanFilter } from "./BooleanFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { EnumFilter } from "./EnumFilter";
import { NumberFilter } from "./NumberFilter";
import { TextFilter } from "./TextFilter";

export function FilterWidget({
  filter,
  value,
  onChange,
}: {
  filter: SerializedFilter;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const mode: FilterMode | "auto" = filter.mode === "auto" ? autoDetectMode(filter) : filter.mode;

  switch (mode) {
    case "enum":
    case "multiselect":
      return <EnumFilter filter={filter} value={value} onChange={onChange} />;
    case "dateRange":
      return <DateRangeFilter value={value} onChange={onChange} />;
    case "boolean":
      return <BooleanFilter value={value} onChange={onChange} />;
    case "number":
    case "range":
      return <NumberFilter filter={filter} value={value} onChange={onChange} />;
    case "text":
    default:
      return <TextFilter filter={filter} value={value} onChange={onChange} />;
  }
}

function autoDetectMode(filter: SerializedFilter): FilterMode {
  if (filter.opts?.options && filter.opts.options.length > 0) return "enum";
  return "text";
}

export { BooleanFilter, DateRangeFilter, EnumFilter, NumberFilter, TextFilter };
