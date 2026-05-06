"use client";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import * as React from "react";
import { Button } from "../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

export interface AsyncSelectOption {
  label: string;
  value: string;
}

export interface AsyncSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  loadOptions: (query: string) => Promise<AsyncSelectOption[]>;
  placeholder?: string;
  emptyText?: string;
  debounceMs?: number;
  className?: string;
}

export function AsyncSelect({
  value,
  onChange,
  loadOptions,
  placeholder = "Select…",
  emptyText = "No options",
  debounceMs = 200,
  className,
}: AsyncSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [opts, setOpts] = React.useState<AsyncSelectOption[]>([]);
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await loadOptions(query);
        if (!cancelled) setOpts(r);
      } catch {
        if (!cancelled) setOpts([]);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, debounceMs, loadOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          className={`w-full justify-between border border-fp-border-1 ${className ?? ""}`}
        >
          <span className={label || value ? "text-fp-text-1" : "text-fp-text-3"}>
            {label ?? value ?? placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Command shouldFilter={false} className="rounded-fp border border-fp-border-1 bg-fp-bg-1">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            className="h-9 w-full border-b border-fp-border-1 bg-transparent px-3 text-sm outline-none placeholder:text-fp-text-3"
          />
          <CommandList className="max-h-60 overflow-auto p-1">
            <CommandEmpty className="px-3 py-4 text-center text-sm text-fp-text-3">
              {emptyText}
            </CommandEmpty>
            {opts.map((o) => (
              <CommandItem
                key={o.value}
                value={o.label}
                onSelect={() => {
                  onChange(o.value);
                  setLabel(o.label);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-sm px-2 py-1.5 text-sm aria-selected:bg-fp-bg-2"
              >
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
