"use client";
import { failureMessage, formatCount, formatLabel } from "@flowpanel/core/labels";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useToast } from "../feedback/toast-api";
import { connectionMessage } from "../lib/connection-message";
import { isReply, readReply, textOf } from "../lib/json-reply";
import { useApiBase } from "../provider/ApiBaseContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import type { ImportOutcome } from "./ImportDialogs";
import type { FailedImportRow, ImportFile, ImportFormat } from "./import-file";

type ImportFlow = typeof import("./ImportDialogs");

let flowLoad: Promise<ImportFlow | null> | null = null;

/** The parser and dialogs, loaded on the first file pick; `null` when the chunk cannot load. */
function loadFlow(): Promise<ImportFlow | null> {
  flowLoad ??= import("./ImportDialogs").catch(() => {
    flowLoad = null;
    return null;
  });
  return flowLoad;
}

export interface ImportButtonProps {
  /** Resource name — the POST target `<apiBase>/<resource>/import`. */
  resource: string;
  formats: ImportFormat[];
  label: string;
  /** The headers the import reads, lower-cased; the confirm step names the file's others as skipped. */
  headers?: string[];
}

function failedRowsOf(value: unknown): FailedImportRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FailedImportRow[] => {
    if (!isReply(item) || typeof item.row !== "number") return [];
    return [{ row: item.row, error: textOf(item.error) ?? "" }];
  });
}

/** Imports a CSV or JSON file: asks with its row count, then lists the rows the server refused. */
export function ImportButton({ resource, formats, label, headers }: ImportButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const apiBase = useApiBase();
  const { locale } = useFormatting();
  const { importer, errors } = useLabels();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<ImportFile | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<ImportOutcome | null>(null);
  const [flow, setFlow] = React.useState<ImportFlow | null>(null);
  const extensions = formats.map((format) => `.${format}`).join(", ");

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    const format = formats.find((f) => picked.name.toLowerCase().endsWith(`.${f}`));
    if (!format) {
      toast.error(formatLabel(importer.unsupported, { formats: extensions }));
      return;
    }
    const loaded = await loadFlow();
    if (!loaded) {
      toast.error(connectionMessage(errors));
      return;
    }
    setFlow(() => loaded);
    const file = loaded.readImportFile(picked.name, format, await picked.text());
    if (!file) {
      toast.error(formatLabel(importer.unreadable, { formats: `.${format}` }));
    } else if (file.rowCount === 0) {
      toast.error(importer.empty);
    } else {
      setPending(file);
    }
  }

  async function send(file: ImportFile) {
    setBusy(true);
    try {
      let response: Response;
      try {
        response = await fetch(`${apiBase}/${encodeURIComponent(resource)}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: file.format, content: file.content }),
        });
      } catch {
        toast.error(connectionMessage(errors));
        return;
      }
      const data = await readReply(response);
      if (!response.ok || data.ok !== true) {
        toast.error(failureMessage(errors, data.code, textOf(data.error)) ?? importer.failed);
        return;
      }
      const imported = typeof data.imported === "number" ? data.imported : 0;
      const failed = failedRowsOf(data.failed);
      if (failed.length > 0) setOutcome({ file, imported, failed });
      else toast.success(formatCount(importer.imported, imported, locale));
      if (imported > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={formats.map((format) => `.${format}`).join(",")}
        className="fp-hidden"
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-disabled={busy || undefined}
        aria-label={busy ? importer.importing : label}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
      >
        <Upload aria-hidden className="fp-h-4 fp-w-4 fp-text-faint sm:fp-hidden" />
        <span className="fp-hidden sm:fp-inline">{busy ? importer.importing : label}</span>
      </Button>
      {flow && pending ? (
        <flow.ImportConfirm
          file={pending}
          skipped={headers ? flow.skippedColumns(pending.header, headers) : []}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            void send(pending);
          }}
        />
      ) : null}
      {flow && outcome ? (
        <flow.ImportResult outcome={outcome} onClose={() => setOutcome(null)} />
      ) : null}
    </>
  );
}
