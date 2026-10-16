"use client";
import { formatLabel } from "@flowpanel/core/labels";
import * as React from "react";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
import { INVALID_WITHIN, Input } from "../ui/input";

export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  className?: string;
  id?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

export function TagInput({
  value,
  onChange,
  placeholder,
  max,
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": describedBy,
  "aria-required": ariaRequired,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const { form } = useLabels();

  const push = () => {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (max !== undefined && value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "fp-flex fp-flex-wrap fp-items-center fp-gap-1.5 fp-rounded fp-border fp-border-line fp-bg-surface fp-p-1.5 fp-shadow-xs fp-transition-colors focus-within:fp-border-focus focus-within:fp-ring-2 focus-within:fp-ring-focus/25",
        INVALID_WITHIN,
        className,
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="fp-inline-flex fp-items-center fp-gap-1 fp-rounded-sm fp-bg-canvas fp-px-2 fp-py-0.5 fp-text-xs fp-text-ink"
        >
          {t}
          <button
            type="button"
            aria-label={formatLabel(form.removeTag, { tag: t })}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="fp-text-faint fp-transition-colors hover:fp-text-ink"
          >
            ×
          </button>
        </span>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            push();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={push}
        placeholder={value.length === 0 ? (placeholder ?? form.tagPlaceholder) : undefined}
        aria-invalid={ariaInvalid}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        {...(ariaRequired ? { "aria-required": true as const } : {})}
        className="fp-h-7 fp-flex-1 fp-min-w-[80px] fp-border-0 fp-bg-transparent fp-p-0 fp-text-sm fp-shadow-none focus-visible:fp-ring-0"
      />
    </div>
  );
}
