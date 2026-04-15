// Native <input type="date"> provides accessible date input across browsers.
// Swap for shadcn Calendar + react-day-picker in Phase 2 if richer UX is needed.
import { Input } from "../../ui/input";

interface DateRangeValue {
  from?: string;
  to?: string;
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const range = (value as DateRangeValue | undefined) ?? {};

  const handleFrom = (from: string) => {
    onChange({ ...range, from: from || undefined });
  };

  const handleTo = (to: string) => {
    onChange({ ...range, to: to || undefined });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        className="h-8 text-sm"
        value={range.from ?? ""}
        onChange={(e) => handleFrom(e.target.value)}
        placeholder="From"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <Input
        type="date"
        className="h-8 text-sm"
        value={range.to ?? ""}
        onChange={(e) => handleTo(e.target.value)}
        placeholder="To"
      />
    </div>
  );
}
