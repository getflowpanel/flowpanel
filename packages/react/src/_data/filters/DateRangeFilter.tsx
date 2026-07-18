"use client";

export interface DateRangeFilterProps {
  field: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

const DATE_INPUT =
  "h-8 w-[8.25rem] rounded-fp-sm border-0 bg-transparent px-1.5 text-sm text-fp-text-1 outline-none [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100";

export function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const [from, to] = (value ?? ":").split(":");
  const emit = (nextFrom: string, nextTo: string) => {
    const combined = `${nextFrom}:${nextTo}`;
    onChange(combined === ":" ? null : combined);
  };
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs font-medium text-fp-text-3">{label}</span> : null}
      <div className="flex h-9 w-fit items-center gap-0.5 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-1.5 shadow-fp-xs transition-colors hover:border-fp-border-2 focus-within:border-fp-focus focus-within:ring-2 focus-within:ring-fp-focus/25 focus-within:hover:border-fp-focus">
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => emit(e.target.value, to ?? "")}
          className={DATE_INPUT}
          aria-label="From"
        />
        <span aria-hidden className="px-0.5 text-fp-text-3">
          –
        </span>
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => emit(from ?? "", e.target.value)}
          className={DATE_INPUT}
          aria-label="To"
        />
      </div>
    </div>
  );
}
