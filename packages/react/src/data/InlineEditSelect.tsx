"use client";
import * as React from "react";
import { cn } from "../lib/cn";

/** The inline editor's box, shared by the text input and the select. */
export const editorClass = (className?: string) =>
  cn(
    "-fp-my-[3px] fp-w-full fp-rounded-sm fp-border fp-border-line-strong fp-bg-surface fp-px-1.5 fp-py-0.5 fp-text-ink focus:fp-border-accent focus:fp-outline-none",
    className,
  );

export interface InlineEditSelectProps {
  label: string;
  /** The stored value, kept as an option when the choices lack it. */
  current: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  draft: string;
  disabled: boolean;
  onDraft: (value: string) => void;
  /** Saves a value picked with the pointer, touch or assistive tech; the keyboard saves with Enter or by leaving. */
  onPick: (value: string) => void;
  onLeave: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  className?: string;
}

/** A cell's choice editor: arrow keys only move the draft, so a keyboard user saves nothing by browsing. */
export const InlineEditSelect = React.forwardRef<HTMLSelectElement, InlineEditSelectProps>(
  function InlineEditSelect(
    { label, current, choices, draft, disabled, onDraft, onPick, onLeave, onKeyDown, className },
    ref,
  ) {
    const browsing = React.useRef(false);
    return (
      <select
        ref={ref}
        aria-label={label}
        value={draft}
        disabled={disabled}
        onPointerDown={() => {
          browsing.current = false;
        }}
        onKeyDown={(event) => {
          browsing.current = event.key !== "Enter" && event.key !== "Tab";
          onKeyDown(event);
        }}
        onChange={(event) => {
          onDraft(event.target.value);
          if (!browsing.current) onPick(event.target.value);
        }}
        onBlur={onLeave}
        onClick={(event) => event.stopPropagation()}
        className={editorClass(className)}
      >
        {choices.some((choice) => choice.value === current) ? null : (
          <option value={current}>{current === "" ? "—" : current}</option>
        )}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  },
);
