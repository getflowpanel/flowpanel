import type { SerializedFilter } from "@flowpanel/core";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export function EnumFilter({
  filter,
  value,
  onChange,
}: {
  filter: SerializedFilter;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const options = filter.opts?.options ?? [];
  const current = value === undefined || value === null ? "" : String(value);

  return (
    <Select value={current} onValueChange={(val) => onChange(val === "__all__" ? undefined : val)}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={filter.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
