"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useToast } from "../_feedback/Toast.js";
import { Button } from "../ui/button.js";

export interface ImportButtonProps {
  /** Resource name — the POST target `/api/flowpanel/<resource>/import`. */
  resource: string;
  formats: ("csv" | "json")[];
  label: string;
}

/** Toolbar button that uploads a CSV / JSON file to the resource's import route. */
export function ImportButton({ resource, formats, label }: ImportButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name.toLowerCase();
    const format = formats.find((f) => name.endsWith(`.${f}`));
    if (!format) {
      toast.error(`Unsupported file type — expected ${formats.map((f) => `.${f}`).join(" or ")}`);
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      const res = await fetch(`/api/flowpanel/${resource}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        imported?: number;
        failed?: unknown[];
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? "Import failed");
        return;
      }
      const failed = data.failed?.length ?? 0;
      const imported = data.imported ?? 0;
      if (failed > 0) {
        toast.warning(`Imported ${imported}, ${failed} failed`);
      } else {
        toast.success(`Imported ${imported} ${imported === 1 ? "row" : "rows"}`);
      }
      router.refresh();
    } catch {
      toast.error("Import failed");
    } finally {
      setBusy(false);
    }
  }

  const accept = formats.map((f) => `.${f}`).join(",");
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : label}
      </Button>
    </>
  );
}
