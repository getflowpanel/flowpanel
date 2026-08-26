"use client";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import * as React from "react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

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
  initialLabel?: string | null;
  id?: string;
  /** Set when a `<label>` is already wired to `id` — suppresses the `aria-label` fallback below. */
  hasLabel?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

export function AsyncSelect({
  value,
  onChange,
  loadOptions,
  placeholder = "Select…",
  emptyText = "No options",
  debounceMs = 200,
  className,
  initialLabel = null,
  id,
  hasLabel = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": describedBy,
  "aria-required": ariaRequired,
}: AsyncSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [opts, setOpts] = React.useState<AsyncSelectOption[]>([]);
  const [label, setLabel] = React.useState<string | null>(initialLabel);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    // Adopt a label resolved after mount, but never `null` — that also fires
    // for a just-picked remote option absent from the preloaded `options` list.
    if (initialLabel !== null) setLabel(initialLabel);
  }, [initialLabel]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const t = setTimeout(async () => {
      try {
        const r = await loadOptions(query);
        if (cancelled) return;
        setOpts(r);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setOpts([]);
        setError(true);
        setLoading(false);
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
          id={id}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          {...(hasLabel ? {} : { "aria-label": placeholder })}
          aria-invalid={ariaInvalid}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
          {...(ariaRequired ? { "aria-required": true as const } : {})}
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
            {loading ? (
              <div role="status" className="px-3 py-4 text-center text-sm text-fp-text-3">
                Searching…
              </div>
            ) : error ? (
              <div role="alert" className="px-3 py-4 text-center text-sm text-fp-err-text">
                Couldn't load options — please try again.
              </div>
            ) : (
              <CommandEmpty className="px-3 py-4 text-center text-sm text-fp-text-3">
                {emptyText}
              </CommandEmpty>
            )}
            {!loading && !error
              ? opts.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      onChange(o.value);
                      setLabel(o.label);
                      setOpen(false);
                    }}
                    className="cursor-pointer rounded-fp-sm px-2 py-1.5 text-sm aria-selected:bg-fp-bg-2"
                  >
                    {o.label}
                  </CommandItem>
                ))
              : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
