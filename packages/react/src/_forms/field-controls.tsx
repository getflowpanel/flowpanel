// LOC-OK: nine sibling controls sharing one useStringControl wiring; splitting duplicates it
"use client";
import {
  type FieldMetadata,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useInputControl,
} from "@conform-to/react";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { JsonEditor } from "../_data/JsonEditor";
import { TagInput } from "../_data/TagInput";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { AsyncSelect, type AsyncSelectOption } from "./AsyncSelect";
import type { FieldControlType } from "./Field";

export interface AriaProps {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

/** Wrap a composite control in a disabled `<fieldset>` so every native input inside goes inert. */
function InertWhenReadOnly({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

const CONTROL_CLASS =
  "w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-2 text-sm shadow-fp-xs transition-colors hover:border-fp-border-2 focus:border-fp-focus focus:outline-none focus:ring-2 focus:ring-fp-focus/25";

/**
 * A native `<select>` — the form posts to a route, so the control has to
 * submit itself — dressed to match `ui/select`'s trigger: the platform
 * chevron is dropped for the kit's own, drawn by the wrapper below.
 */
const SELECT_CLASS = `${CONTROL_CLASS} h-9 appearance-none py-0 pr-9 text-fp-text-1 disabled:cursor-not-allowed disabled:opacity-50`;

type ScalarInputType =
  | "text"
  | "email"
  | "password"
  | "url"
  | "number"
  | "date"
  | "datetime-local"
  | "time"
  | "color"
  | "search"
  | "hidden";
export const SCALAR_TYPE: Partial<Record<FieldControlType, ScalarInputType>> = {
  text: "text",
  email: "email",
  password: "password",
  url: "url",
  number: "number",
  date: "date",
  datetime: "datetime-local",
  "datetime-local": "datetime-local",
  time: "time",
  color: "color",
  search: "search",
  hidden: "hidden",
};

/** Seed a `useInputControl` from a field's CURRENT value (`field.value`, not `field.initialValue`). */
function useStringControl(field: FieldMetadata<unknown>) {
  return useInputControl<string>({
    key: field.key,
    name: field.name,
    formId: field.formId,
    initialValue: typeof field.value === "string" ? field.value : undefined,
  });
}

interface HiddenControlProps {
  field: FieldMetadata<unknown>;
  readOnly: boolean;
  aria: AriaProps;
}

export function JsonField({ field, readOnly, aria }: HiddenControlProps) {
  const control = useStringControl(field);
  const parsed = React.useMemo<unknown>(() => {
    if (!control.value) return {};
    try {
      return JSON.parse(control.value);
    } catch {
      return {};
    }
  }, [control.value]);
  return (
    <>
      <input type="hidden" name={field.name} defaultValue={control.value} />
      <InertWhenReadOnly readOnly={readOnly}>
        <JsonEditor
          id={field.id}
          value={parsed}
          onChange={(v) => control.change(JSON.stringify(v))}
          {...aria}
        />
      </InertWhenReadOnly>
    </>
  );
}

/** Lossless list encoding for the single hidden-input value tags/multiselect submit — a bare comma-join can't survive a comma inside an item. */
function encodeList(list: string[]): string {
  return JSON.stringify(list);
}

function decodeList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function TagsField({ field, readOnly, aria }: HiddenControlProps) {
  const control = useStringControl(field);
  const list = React.useMemo(() => decodeList(control.value), [control.value]);
  return (
    <>
      <input type="hidden" name={field.name} defaultValue={control.value} />
      <InertWhenReadOnly readOnly={readOnly}>
        <TagInput
          id={field.id}
          value={list}
          onChange={(next) => control.change(encodeList(next))}
          {...aria}
        />
      </InertWhenReadOnly>
    </>
  );
}

interface MultiSelectFieldProps extends HiddenControlProps {
  label?: string;
  labelId?: string;
  options: { label: string; value: string }[];
}

export function MultiSelectField({
  field,
  readOnly,
  label,
  labelId,
  options,
  aria,
}: MultiSelectFieldProps) {
  const control = useStringControl(field);
  const list = React.useMemo(() => decodeList(control.value), [control.value]);
  return (
    <>
      <input type="hidden" name={field.name} defaultValue={control.value} />
      <fieldset
        {...(readOnly ? { disabled: true } : {})}
        {...(labelId ? { "aria-labelledby": labelId } : { "aria-label": label ?? field.name })}
        {...aria}
        className="m-0 flex min-w-0 flex-wrap gap-2 rounded-fp border border-fp-border-1 bg-fp-bg-1 p-2"
      >
        {options.map((o) => {
          const checked = list.includes(o.value);
          const optionId = `${field.id}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={optionId}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 px-2 py-1 text-xs"
            >
              <Checkbox
                id={optionId}
                checked={checked}
                onCheckedChange={(next) => {
                  const set = new Set(list);
                  if (next === true) set.add(o.value);
                  else set.delete(o.value);
                  control.change(encodeList(Array.from(set)));
                }}
                className="h-3.5 w-3.5"
              />
              {o.label}
            </label>
          );
        })}
      </fieldset>
    </>
  );
}

interface ReferenceFieldProps extends HiddenControlProps {
  options: { label: string; value: string }[];
  placeholder?: string;
  /** See `FieldProps.referenceSearchUrl`. */
  searchUrl?: string;
  /** Whether `Field` rendered a `<label>` targeting this control's id. */
  hasLabel: boolean;
}

export function ReferenceField({
  field,
  readOnly,
  options,
  placeholder,
  searchUrl,
  aria,
  hasLabel,
}: ReferenceFieldProps) {
  const control = useStringControl(field);
  const initialLabel = options.find((o) => o.value === control.value)?.label ?? null;
  const loadOptions = React.useCallback(
    async (q: string): Promise<AsyncSelectOption[]> => {
      if (!searchUrl) {
        return options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
      }
      const res = await fetch(`${searchUrl}?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("reference search failed");
      const data = (await res.json()) as { options?: AsyncSelectOption[] };
      return data.options ?? [];
    },
    [searchUrl, options],
  );
  return (
    <>
      <input type="hidden" name={field.name} defaultValue={control.value} />
      <InertWhenReadOnly readOnly={readOnly}>
        <AsyncSelect
          id={field.id}
          hasLabel={hasLabel}
          value={control.value || null}
          onChange={(v) => control.change(v ?? "")}
          loadOptions={loadOptions}
          initialLabel={initialLabel}
          placeholder={placeholder ?? "Search…"}
          {...aria}
        />
      </InertWhenReadOnly>
    </>
  );
}

interface ScalarFieldProps {
  field: FieldMetadata<unknown>;
  type: ScalarInputType;
  placeholder?: string;
  autoComplete?: string;
  readOnly: boolean;
  aria: AriaProps;
}

/** Plain scalar inputs (text/email/password/url/number/date/…). */
export function ScalarField({
  field,
  type,
  placeholder,
  autoComplete,
  readOnly,
  aria,
}: ScalarFieldProps) {
  const control = useStringControl(field);
  return (
    <Input
      {...getInputProps(field, { type, value: false })}
      value={control.value ?? ""}
      onChange={(e) => control.change(e.target.value)}
      {...(placeholder ? { placeholder } : {})}
      {...(autoComplete ? { autoComplete } : {})}
      {...(readOnly ? { readOnly: true } : {})}
      {...aria}
    />
  );
}

interface TextareaFieldProps {
  field: FieldMetadata<unknown>;
  markdown: boolean;
  placeholder?: string;
  readOnly: boolean;
  aria: AriaProps;
}

export function TextareaField({
  field,
  markdown,
  placeholder,
  readOnly,
  aria,
}: TextareaFieldProps) {
  const control = useStringControl(field);
  return (
    <textarea
      {...getTextareaProps(field, { value: false })}
      value={control.value ?? ""}
      onChange={(e) => control.change(e.target.value)}
      rows={markdown ? 8 : 4}
      {...(placeholder ? { placeholder } : {})}
      {...(readOnly ? { readOnly: true } : {})}
      {...aria}
      className={`${CONTROL_CLASS} ${markdown ? "font-mono" : ""}`}
    />
  );
}

interface SelectFieldProps {
  field: FieldMetadata<unknown>;
  placeholder?: string;
  readOnly: boolean;
  aria: AriaProps;
  options: { label: string; value: string }[];
  /** Submitted by a hidden input when read-only: a disabled control posts nothing. */
  rawValue: unknown;
}

export function SelectField({
  field,
  placeholder,
  readOnly,
  aria,
  options,
  rawValue,
}: SelectFieldProps) {
  const control = useStringControl(field);
  return (
    <>
      {readOnly ? (
        <input type="hidden" name={field.name} value={rawValue == null ? "" : String(rawValue)} />
      ) : null}
      <div className="relative">
        <select
          {...getSelectProps(field, { value: false })}
          value={control.value ?? ""}
          onChange={(e) => control.change(e.target.value)}
          {...(readOnly ? { disabled: true } : {})}
          {...aria}
          className={SELECT_CLASS}
        >
          <option value="">{placeholder ?? "Select…"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fp-text-2 opacity-50"
        />
      </div>
    </>
  );
}

interface RadioFieldProps {
  field: FieldMetadata<unknown>;
  readOnly: boolean;
  options: { label: string; value: string }[];
  rawValue: unknown;
  aria: AriaProps;
  labelId?: string;
}

export function RadioField({ field, readOnly, options, rawValue, aria, labelId }: RadioFieldProps) {
  const control = useStringControl(field);
  return (
    <fieldset
      {...(labelId ? { "aria-labelledby": labelId } : {})}
      {...aria}
      className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
    >
      {readOnly && rawValue != null && rawValue !== "" ? (
        <input type="hidden" name={field.name} value={String(rawValue)} />
      ) : null}
      {options.map((o) => (
        <label key={o.value} className="inline-flex items-center gap-2 text-sm text-fp-text-1">
          <input
            {...getInputProps(field, { type: "radio", value: false })}
            value={o.value}
            checked={control.value === o.value}
            onChange={() => control.change(o.value)}
            {...(readOnly ? { disabled: true } : {})}
            className="accent-fp-accent"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

interface CheckboxFieldProps {
  field: FieldMetadata<unknown>;
  readOnly: boolean;
  aria: AriaProps;
}

export function CheckboxField({ field, readOnly, aria }: CheckboxFieldProps) {
  const control = useStringControl(field);
  const checked = control.value === "on" || control.value === "true";
  return (
    <>
      {readOnly && checked ? <input type="hidden" name={field.name} value="on" /> : null}
      <input
        {...getInputProps(field, { type: "checkbox", value: false })}
        checked={checked}
        onChange={(e) => control.change(e.target.checked ? "on" : "")}
        {...(readOnly ? { disabled: true } : {})}
        {...aria}
        className="h-4 w-4 accent-fp-accent"
      />
    </>
  );
}
