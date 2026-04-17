import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export function BooleanFilter({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const current = value === true ? "true" : value === false ? "false" : "__any__";

  return (
    <Select
      value={current}
      onValueChange={(val) => {
        if (val === "__any__") onChange(undefined);
        else onChange(val === "true");
      }}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Any" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__any__">Any</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
      </SelectContent>
    </Select>
  );
}
