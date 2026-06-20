"use client";
import type { ColumnMeta } from "@flowpanel/core";
import * as React from "react";
import { z } from "zod";
import { humanize } from "../lib/humanize.js";
import { Field } from "./Field.js";
import { Form } from "./Form.js";
import { FormError } from "./FormError.js";
import { FormSection } from "./FormSection.js";
import { FormSubmit } from "./FormSubmit.js";
import type { ResolvedField } from "./field-types.js";

type InputType = NonNullable<React.ComponentProps<typeof Field>["type"]>;

function inputTypeFor(meta: ColumnMeta): InputType {
  switch (meta.type) {
    case "number":
      return "number";
    case "boolean":
      return "checkbox";
    case "date":
      return "datetime-local";
    case "json":
      return "json";
    default:
      return "text";
  }
}

const SPAN_CLASS: Record<NonNullable<ResolvedField["span"]>, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
  12: "sm:col-span-12",
};

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-12";

export function buildReferenceSearchUrl(action: string, field: string): string | undefined {
  const resource = /^\/api\/flowpanel\/([^/]+)\//.exec(action)?.[1];
  return resource ? `/api/flowpanel/${resource}/reference/${encodeURIComponent(field)}` : undefined;
}

/** One resolved field in its grid cell, sized by `span` (default full width). */
function FieldCell({ field, action }: { field: ResolvedField; action: string }) {
  const searchUrl =
    field.type === "reference" ? buildReferenceSearchUrl(action, field.name) : undefined;
  return (
    <div className={SPAN_CLASS[field.span ?? 12]}>
      <Field
        name={field.name}
        label={field.label}
        type={field.type}
        {...(field.help ? { help: field.help } : {})}
        {...(field.placeholder ? { placeholder: field.placeholder } : {})}
        {...(field.required ? { required: field.required } : {})}
        {...(field.options ? { options: field.options } : {})}
        {...(field.readOnly ? { readOnly: field.readOnly } : {})}
        {...(searchUrl ? { referenceSearchUrl: searchUrl } : {})}
      />
    </div>
  );
}

/** Split fields into consecutive runs sharing a `group`, preserving order. */
function groupBlocks(fields: ResolvedField[]): { group?: string; items: ResolvedField[] }[] {
  const blocks: { group?: string; items: ResolvedField[] }[] = [];
  for (const field of fields) {
    const last = blocks[blocks.length - 1];
    if (last && last.group === field.group) last.items.push(field);
    else blocks.push({ ...(field.group ? { group: field.group } : {}), items: [field] });
  }
  return blocks;
}

export interface AutoFormProps {
  /** POST target for the submission — see `FormProps.action` (`Form.tsx`). */
  action: string;
  /** Explicit field specs from a resource's `create.fields` / `update.fields` (resolved server-side). */
  fields?: ResolvedField[];
  columns?: ColumnMeta[];
  hide?: string[];
  defaultValues?: Record<string, unknown>;
  submitLabel?: string;
  className?: string;
  /** Client-side navigation target on a successful submit — see `FormProps.redirectTo`. */
  redirectTo?: string;
}

export function AutoForm({
  action,
  fields,
  columns = [],
  hide = [],
  defaultValues,
  submitLabel = "Save",
  className,
  redirectTo,
}: AutoFormProps) {
  const introspected = columns.filter((c) => !c.primaryKey && !hide.includes(c.name));
  const names = fields ? fields.map((f) => f.name) : introspected.map((c) => c.name);
  const key = names.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined names string is the stable identity of `names`.
  const schema = React.useMemo(
    () => z.object(Object.fromEntries(names.map((n) => [n, z.unknown().optional()]))),
    [key],
  );

  const merged: Record<string, unknown> = { ...defaultValues };
  for (const f of fields ?? []) {
    if (f.defaultValue !== undefined && merged[f.name] === undefined) {
      merged[f.name] = f.defaultValue;
    }
  }
  const resolvedDefaults = Object.keys(merged).length > 0 ? merged : undefined;

  return (
    <Form
      action={action}
      schema={schema}
      {...(resolvedDefaults ? { defaultValues: resolvedDefaults } : {})}
      {...(className ? { className } : {})}
      {...(redirectTo ? { redirectTo } : {})}
    >
      {fields ? (
        groupBlocks(fields).map((block, i) =>
          block.group ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional, no stable id.
            <FormSection key={`${i}-${block.group}`} label={block.group}>
              <div className={GRID}>
                {block.items.map((f) => (
                  <FieldCell key={f.name} field={f} action={action} />
                ))}
              </div>
            </FormSection>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional, no stable id.
            <div key={`block-${i}`} className={GRID}>
              {block.items.map((f) => (
                <FieldCell key={f.name} field={f} action={action} />
              ))}
            </div>
          ),
        )
      ) : (
        <div className={GRID}>
          {introspected.map((c) => (
            <div key={c.name} className={SPAN_CLASS[12]}>
              <Field name={c.name} label={humanize(c.name)} type={inputTypeFor(c)} />
            </div>
          ))}
        </div>
      )}
      <FormError />
      <FormSubmit>{submitLabel}</FormSubmit>
    </Form>
  );
}
