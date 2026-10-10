"use client";
import { formatCount, formatLabel } from "@flowpanel/core/labels";
import { ConfirmDialog } from "../feedback/ConfirmDialog";
import { triggerDownload } from "../lib/trigger-download";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { type FailedImportRow, failedRowsCsv, type ImportFile } from "./import-file";

export { readImportFile } from "./import-file";

export interface ImportOutcome {
  file: ImportFile;
  imported: number;
  failed: FailedImportRow[];
}

/** Refused rows the dialog lists; the CSV download carries all of them. */
const SHOWN_ROWS = 100;

/** "Import customers.csv? 48 rows will be imported." */
export function ImportConfirm({
  file,
  onCancel,
  onConfirm,
}: {
  file: ImportFile;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { importer } = useLabels();
  const { locale } = useFormatting();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={formatLabel(importer.confirmTitle, { file: file.name })}
      description={formatCount(importer.rows, file.rowCount, locale)}
      confirmLabel={importer.confirm}
      onConfirm={onConfirm}
    />
  );
}

/** The rows an import refused, with their reasons and a CSV of them to fix and import again. */
export function ImportResult({
  outcome,
  onClose,
}: {
  outcome: ImportOutcome;
  onClose: () => void;
}) {
  const { importer } = useLabels();
  const { locale } = useFormatting();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="fp-max-w-xl">
        <DialogHeader>
          <DialogTitle>{importer.doneTitle}</DialogTitle>
          <DialogDescription>
            {`${formatCount(importer.imported, outcome.imported, locale)}. ${formatCount(importer.rejected, outcome.failed.length, locale)}.`}
          </DialogDescription>
        </DialogHeader>
        {
          <ul className="fp-max-h-72 fp-divide-y fp-divide-line fp-overflow-y-auto fp-rounded fp-border fp-border-line fp-text-sm">
            {outcome.failed.slice(0, SHOWN_ROWS).map(({ row, error }) => (
              <li key={row} className="fp-flex fp-gap-3 fp-px-3 fp-py-2">
                <span className="fp-w-20 fp-shrink-0 fp-tabular-nums fp-text-faint">
                  {formatLabel(importer.row, { n: row })}
                </span>
                <span className="fp-min-w-0 fp-break-words fp-text-ink">{error}</span>
              </li>
            ))}
          </ul>
        }
        {outcome.failed.length > SHOWN_ROWS ? (
          <p className="fp-text-sm fp-text-faint">
            {formatLabel(importer.more, { n: outcome.failed.length - SHOWN_ROWS })}
          </p>
        ) : null}
        <DialogFooter className="fp-gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {importer.close}
          </Button>
          {
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                triggerDownload({
                  filename: `${outcome.file.name.replace(/\.(csv|json)$/i, "")}-failed.csv`,
                  data: failedRowsCsv(outcome.file, outcome.failed, "error"),
                  mime: "text/csv;charset=utf-8",
                })
              }
            >
              {importer.download}
            </Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
