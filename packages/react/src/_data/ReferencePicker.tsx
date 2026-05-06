"use client";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import * as React from "react";
import { Button } from "../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

export interface ReferenceItem {
  id: string;
  label: string;
}

export interface ReferencePickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  search: (query: string) => Promise<ReferenceItem[]>;
  placeholder?: string;
  emptyText?: string;
  debounceMs?: number;
  className?: string;
}

export function ReferencePicker({
  value,
  onChange,
  search,
  placeholder = "Search…",
  emptyText = "No results",
  debounceMs = 200,
  className,
}: ReferencePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<ReferenceItem[]>([]);
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await search(query);
        if (!cancelled) setItems(r);
      } catch {
        if (!cancelled) setItems([]);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, debounceMs, search]);

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
          <span className={selectedLabel || value ? "text-fp-text-1" : "text-fp-text-3"}>
            {selectedLabel ?? value ?? placeholder}
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
            {items.map((r) => (
              <CommandItem
                key={r.id}
                value={r.label}
                onSelect={() => {
                  onChange(r.id);
                  setSelectedLabel(r.label);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-sm px-2 py-1.5 text-sm aria-selected:bg-fp-bg-2"
              >
                {r.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
