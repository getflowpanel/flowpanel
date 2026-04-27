import type { FieldMetadata } from "@flowpanel/core";
import type { ReactNode } from "react";
import { DateField } from "./DateField";
import { JsonField } from "./JsonField";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { SwitchField } from "./SwitchField";
import { TextareaField } from "./TextareaField";
import type { FieldProps } from "./TextField";
import { TextField } from "./TextField";

export type { FieldProps };

/**
 * Custom form-field renderer override. Takes precedence over the type-based
 * dispatcher — returns `ReactNode` or `undefined` (undefined = fall through).
 */
export type FieldRenderFn = (props: FieldProps) => ReactNode | undefined;

export interface FieldWidgetProps extends FieldProps {
  /** Field metadata from the model (for type detection and enum values). */
  meta?: FieldMetadata;
  /** Custom renderer (per-field override, takes precedence over type dispatch). */
  render?: FieldRenderFn;
}

export function FieldWidget({ meta, render, ...props }: FieldWidgetProps) {
  // Custom render takes priority.
  if (render) {
    const out = render(props);
    if (out !== undefined) return <>{out}</>;
  }

  if (!meta) {
    return <TextField {...props} />;
  }

  switch (meta.type) {
    case "boolean":
      return <SwitchField {...props} />;
    case "int":
    case "float":
      return <NumberField {...props} />;
    case "datetime":
      return <DateField {...props} />;
    case "json":
      return <JsonField {...props} />;
    case "enum":
      return <SelectField {...props} options={meta.enumValues ?? []} />;
    case "string":
    default:
      // Use textarea for longer text (heuristic: description, content, body, etc.)
      if (
        props.name === "description" ||
        props.name === "content" ||
        props.name === "body" ||
        props.name === "notes" ||
        props.name === "bio"
      ) {
        return <TextareaField {...props} />;
      }
      return <TextField {...props} />;
  }
}

export { DateField, JsonField, NumberField, SelectField, SwitchField, TextareaField, TextField };
