"use client";

import { useState } from "react";
import type { SerializedResource } from "@flowpanel/core";
import { Button } from "../ui/button";
import { toast } from "../ui/sonner";
import { FieldWidget } from "./fields";

interface FormErrors {
  [key: string]: string;
}

function getEditableColumns(resource: SerializedResource) {
  return resource.columns.filter((col) => {
    if (col.type !== "field") return false;
    if (!col.path || col.path.includes(".")) return false;
    // Skip auto-generated fields
    const autoFields = ["id", "createdAt", "updatedAt", "created_at", "updated_at"];
    if (autoFields.includes(col.path)) return false;
    return true;
  });
}

export function ResourceForm({
  resource,
  row,
  baseUrl,
  onSuccess,
  onCancel,
}: {
  resource: SerializedResource;
  row?: Record<string, unknown>;
  baseUrl: string;
  onSuccess?: (savedRow: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const isEdit = !!row;
  const editableColumns = getEditableColumns(resource);

  // Initialize form values
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const col of editableColumns) {
      if (col.path) {
        init[col.path] = isEdit ? row?.[col.path] : undefined;
      }
    }
    return init;
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setErrors({});

    try {
      const endpoint = isEdit
        ? `${baseUrl}/flowpanel.resource.update`
        : `${baseUrl}/flowpanel.resource.create`;

      const body = isEdit
        ? { resourceId: resource.id, recordId: row?.id, data: values }
        : { resourceId: resource.id, data: values };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as
        | {
            result?: { data?: Record<string, unknown> };
            error?: {
              message?: string;
              data?: { zodError?: { fieldErrors?: Record<string, string[]> } };
            };
          }
        | Record<string, unknown>;

      if (!response.ok) {
        // Try to extract validation errors
        const err = "error" in json ? json.error : undefined;
        if (err && typeof err === "object" && "data" in err) {
          const zodError = (
            err as { data?: { zodError?: { fieldErrors?: Record<string, string[]> } } }
          ).data?.zodError;
          if (zodError?.fieldErrors) {
            const newErrors: FormErrors = {};
            for (const [field, messages] of Object.entries(zodError.fieldErrors)) {
              newErrors[field] = messages[0] ?? "Invalid value";
            }
            setErrors(newErrors);
            return;
          }
        }
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : `Server returned ${response.status}`;
        setGlobalError(message);
        return;
      }

      const jsonObj = json as { result?: { data?: Record<string, unknown> } };
      const saved =
        "result" in json && jsonObj.result?.data
          ? jsonObj.result.data
          : (json as Record<string, unknown>);

      toast.success(isEdit ? `${resource.label} updated` : `${resource.label} created`);
      onSuccess?.(saved);
    } catch (err) {
      const message = (err as Error).message ?? "An unexpected error occurred";
      setGlobalError(message);
      toast.error(isEdit ? "Update failed" : "Create failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const setValue = (path: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [path]: value }));
    if (errors[path]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      {globalError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {globalError}
        </div>
      )}

      {editableColumns.map((col) => {
        if (!col.path) return null;
        const path = col.path;
        // Build minimal FieldMetadata from column info
        const meta = {
          name: path,
          type: (col.format === "boolean"
            ? "boolean"
            : col.format === "number" || col.format === "money" || col.format === "percent"
              ? "int"
              : col.format === "relative" || col.format === "absolute" || col.format === "calendar"
                ? "datetime"
                : col.format === "json"
                  ? "json"
                  : col.format === "enum"
                    ? "enum"
                    : "string") as
            | "string"
            | "int"
            | "float"
            | "boolean"
            | "datetime"
            | "json"
            | "enum"
            | "relation",
          kind: "scalar" as const,
          isRequired: false,
          isList: false,
          isId: false,
          isAutoGenerated: false,
        };

        return (
          <FieldWidget
            key={col.id}
            name={path}
            label={col.label}
            value={values[path]}
            onChange={(val) => setValue(path, val)}
            error={errors[path]}
            meta={meta}
            disabled={submitting}
          />
        );
      })}

      {editableColumns.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No editable fields available.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting || editableColumns.length === 0}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : `Create ${resource.label}`}
        </Button>
      </div>
    </form>
  );
}
