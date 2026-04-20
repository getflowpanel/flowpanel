import type { FieldMetadata } from "@flowpanel/core";
import type { FieldProps } from "./TextField";
import { TextField } from "./TextField";
import { TextareaField } from "./TextareaField";
import { SelectField } from "./SelectField";
import { DateField } from "./DateField";
import { SwitchField } from "./SwitchField";
import { NumberField } from "./NumberField";
import { JsonField } from "./JsonField";

export type { FieldProps };

export interface FieldWidgetProps extends FieldProps {
  /** Field metadata from the model (for type detection and enum values). */
  meta?: FieldMetadata;
}

export function FieldWidget({ meta, ...props }: FieldWidgetProps) {
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

export { TextField, TextareaField, SelectField, DateField, SwitchField, NumberField, JsonField };
