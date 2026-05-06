"use client";
import * as React from "react";
import { Input } from "../ui/input.js";

export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  className?: string;
}

export function TagInput({ value, onChange, placeholder = "Add…", max, className }: TagInputProps) {
  const [draft, setDraft] = React.useState("");

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
      className={`flex flex-wrap items-center gap-1.5 rounded-fp border border-fp-border-1 bg-fp-bg-1 p-1.5 focus-within:ring-2 focus-within:ring-fp-accent ${className ?? ""}`}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-sm bg-fp-bg-2 px-2 py-0.5 text-xs text-fp-text-1"
        >
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-fp-text-3 transition-colors hover:text-fp-text-1"
          >
            ×
          </button>
        </span>
      ))}
      <Input
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
        placeholder={value.length === 0 ? placeholder : undefined}
        className="h-7 flex-1 min-w-[80px] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
