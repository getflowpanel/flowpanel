"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
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

const ITEM_CLASS =
  "fp-cursor-pointer fp-rounded-sm fp-px-2 fp-py-1.5 fp-text-sm aria-selected:fp-bg-canvas";
const MESSAGE_CLASS = "fp-px-3 fp-py-4 fp-text-center fp-text-sm";

export function AsyncSelect({
  value,
  onChange,
  loadOptions,
  placeholder: placeholderProp,
  emptyText: emptyTextProp,
  debounceMs = 200,
  className,
  initialLabel = null,
  id,
  hasLabel = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": describedBy,
  "aria-required": ariaRequired,
}: AsyncSelectProps) {
  const labels = useLabels();
  // An explicit prop wins, including an empty string.
  const placeholder = placeholderProp ?? labels.form.selectPlaceholder;
  const emptyText = emptyTextProp ?? labels.form.noOptions;
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [opts, setOpts] = React.useState<AsyncSelectOption[]>([]);
  const [active, setActive] = React.useState(0);
  const [label, setLabel] = React.useState<string | null>(initialLabel);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Adopt a new label from the parent in this render; never adopt `null`, which also arrives for a
  // just-picked option absent from the preloaded list.
  const [seenLabel, setSeenLabel] = React.useState(initialLabel);
  if (seenLabel !== initialLabel) {
    setSeenLabel(initialLabel);
    if (initialLabel !== null) setLabel(initialLabel);
  }

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
        setActive(0);
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

  const pick = (option: AsyncSelectOption): void => {
    onChange(option.value);
    setLabel(option.label);
    setOpen(false);
  };

  const showList = !loading && !error && opts.length > 0;
  const message = loading
    ? labels.form.searching
    : error
      ? labels.form.loadFailed
      : opts.length === 0
        ? emptyText
        : null;

  React.useEffect(() => {
    if (!showList) return;
    const option = document.getElementById(`${listId}-${active}`);
    option?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId, showList]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    // Tab leaves the picker the way it found it: nothing selected, focus moving on.
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!showList) return;
    const last = opts.length - 1;
    // An open picker owns its keys: `Ctrl+K` must move up here, not reach the ⌘K palette.
    const claim = () => {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
    };
    const move = (next: number) => {
      claim();
      setActive(next < 0 ? 0 : next > last ? last : next);
    };
    const vim = event.ctrlKey && !event.altKey;
    const down = event.key === "ArrowDown" || (vim && (event.key === "n" || event.key === "j"));
    const up = event.key === "ArrowUp" || (vim && (event.key === "p" || event.key === "k"));
    if (down) move(event.metaKey ? last : active + 1);
    else if (up) move(event.metaKey ? 0 : active - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(last);
    else if (event.key === "Enter") {
      const option = opts[active];
      if (option) {
        claim();
        pick(option);
      }
    }
  };

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
          className={cn("fp-w-full fp-justify-between fp-border fp-border-line", className)}
        >
          <span className={label || value ? "fp-text-ink" : "fp-text-faint"}>
            {label ?? value ?? placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="fp-p-0">
        <div className="fp-rounded fp-border fp-border-line fp-bg-surface">
          <input
            id={`${listId}-search`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            {...(showList ? { "aria-activedescendant": `${listId}-${active}` } : {})}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="fp-h-9 fp-w-full fp-border-b fp-border-line fp-bg-transparent fp-px-3 fp-text-sm fp-outline-none placeholder:fp-text-faint"
          />
          {/* The scroll port is the listbox itself: only then is it exempt from `scrollable-region-focusable`. */}
          <div
            id={listId}
            role="listbox"
            aria-label={placeholder}
            className={`fp-max-h-60 fp-overflow-auto ${showList ? "fp-p-1" : ""}`}
          >
            {showList
              ? opts.map((o, i) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection runs on the search box, which owns aria-activedescendant
                  <div
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                    className={ITEM_CLASS}
                  >
                    {o.label}
                  </div>
                ))
              : null}
          </div>
          {message !== null ? (
            <div
              role={error ? "alert" : "status"}
              className={`${MESSAGE_CLASS} ${error ? "fp-text-err-ink" : "fp-text-faint"}`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
