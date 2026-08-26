"use client";
import { getInputProps } from "@conform-to/react";
import type * as React from "react";
import { Label } from "../ui/label";
import { useFormContext } from "./Form";
import {
  type AriaProps,
  CheckboxField,
  JsonField,
  MultiSelectField,
  RadioField,
  ReferenceField,
  SCALAR_TYPE,
  ScalarField,
  SelectField,
  TagsField,
  TextareaField,
} from "./field-controls";

export type FieldControlType =
  | "text"
  | "email"
  | "password"
  | "url"
  | "number"
  | "date"
  | "datetime"
  | "datetime-local"
  | "time"
  | "color"
  | "search"
  | "textarea"
  | "markdown"
  | "json"
  | "tags"
  | "select"
  | "multiselect"
  | "radio"
  | "reference"
  | "boolean"
  | "switch"
  | "checkbox"
  | "hidden";

export interface FieldProps {
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?: FieldControlType;
  required?: boolean;
  options?: { label: string; value: string }[];
  autoComplete?: string;
  /** Render the control non-editable while keeping its value in the submission. */
  readOnly?: boolean;
  referenceSearchUrl?: string;
}

/** Stable identity for the unset case — a fresh `[]` literal default would re-trigger every memo keyed on `options` (`loadOptions`, `AsyncSelect`'s debounce effect) on every render. */
const EMPTY_OPTIONS: { label: string; value: string }[] = [];

export function Field({
  name,
  label,
  help,
  placeholder,
  type = "text",
  required,
  options = EMPTY_OPTIONS,
  autoComplete,
  readOnly = false,
  referenceSearchUrl,
}: FieldProps) {
  const { fields } = useFormContext();
  const field = fields[name];
  const rawValue = field?.value;

  if (!field) return null;

  const errId = `${field.id}-error`;
  const helpId = `${field.id}-help`;
  const hasErrors = Boolean(field.errors && field.errors.length > 0);
  const describedBy = [help ? helpId : null, hasErrors ? errId : null].filter(Boolean).join(" ");
  const aria: AriaProps = {
    ...(required ? { "aria-required": true as const } : {}),
    ...(hasErrors ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  const inlineLabel = type === "boolean" || type === "switch" || type === "checkbox";
  const isGroupType = type === "radio" || type === "multiselect";
  const groupLabelId = isGroupType && label ? `${field.id}-label` : undefined;

  let control: React.ReactNode;
  if (type === "hidden") {
    return <input {...getInputProps(field, { type: "hidden" })} />;
  } else if (type === "json") {
    control = <JsonField field={field} readOnly={readOnly} aria={aria} />;
  } else if (type === "tags") {
    control = <TagsField field={field} readOnly={readOnly} aria={aria} />;
  } else if (type === "textarea" || type === "markdown") {
    control = (
      <TextareaField
        field={field}
        markdown={type === "markdown"}
        {...(placeholder ? { placeholder } : {})}
        readOnly={readOnly}
        aria={aria}
      />
    );
  } else if (type === "select") {
    control = (
      <SelectField
        field={field}
        {...(placeholder ? { placeholder } : {})}
        readOnly={readOnly}
        aria={aria}
        options={options}
        rawValue={rawValue}
      />
    );
  } else if (type === "multiselect") {
    control = (
      <MultiSelectField
        field={field}
        readOnly={readOnly}
        {...(label ? { label } : {})}
        {...(groupLabelId ? { labelId: groupLabelId } : {})}
        options={options}
        aria={aria}
      />
    );
  } else if (type === "radio") {
    control = (
      <RadioField
        field={field}
        readOnly={readOnly}
        options={options}
        rawValue={rawValue}
        aria={aria}
        {...(groupLabelId ? { labelId: groupLabelId } : {})}
      />
    );
  } else if (type === "reference") {
    control = (
      <ReferenceField
        field={field}
        readOnly={readOnly}
        options={options}
        {...(placeholder ? { placeholder } : {})}
        {...(referenceSearchUrl ? { searchUrl: referenceSearchUrl } : {})}
        aria={aria}
        hasLabel={Boolean(label)}
      />
    );
  } else if (inlineLabel) {
    control = <CheckboxField field={field} readOnly={readOnly} aria={aria} />;
  } else {
    control = (
      <ScalarField
        field={field}
        type={SCALAR_TYPE[type] ?? "text"}
        {...(placeholder ? { placeholder } : {})}
        {...(autoComplete ? { autoComplete } : {})}
        readOnly={readOnly}
        aria={aria}
      />
    );
  }

  const labelNode = label ? (
    <Label {...(groupLabelId ? { id: groupLabelId } : { htmlFor: field.id })}>
      {label}
      {required ? <span className="ml-0.5 text-fp-err-text">*</span> : null}
    </Label>
  ) : null;

  return (
    <div className={inlineLabel ? "flex items-center gap-2" : "space-y-1.5"}>
      {inlineLabel ? (
        <>
          {control}
          {labelNode}
        </>
      ) : (
        <>
          {labelNode}
          {control}
        </>
      )}
      {help ? (
        <p id={helpId} className="text-xs text-fp-text-3">
          {help}
        </p>
      ) : null}
      {hasErrors ? (
        <p id={errId} className="text-xs text-fp-err-text" role="alert">
          {field.errors?.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
