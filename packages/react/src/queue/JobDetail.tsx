"use client";

import type { QueueJob, SerializedQueue } from "@flowpanel/core";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { toast } from "../ui/sonner";

export function JobDetail({
  queue,
  job,
  baseUrl,
  onClose,
  onUpdated,
}: {
  queue: SerializedQueue;
  job: QueueJob;
  baseUrl: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const call = async (endpoint: string, label: string) => {
    try {
      const res = await fetch(`${baseUrl}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId: queue.id, jobId: job.id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(`${label} succeeded`);
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(`${label} failed`, { description: (err as Error).message });
    }
  };

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>
              Job <code className="font-mono">{job.id}</code>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={job.name} mono />
              <Field label="State" value={job.state} />
              <Field
                label="Attempts"
                value={`${job.attemptsMade}${job.maxAttempts ? ` of ${job.maxAttempts}` : ""}`}
              />
              <Field label="Scheduled" value={new Date(job.timestamp).toLocaleString()} />
              {job.processedOn && (
                <Field label="Started" value={new Date(job.processedOn).toLocaleString()} />
              )}
              {job.finishedOn && (
                <Field label="Finished" value={new Date(job.finishedOn).toLocaleString()} />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {job.state === "failed" && (
                <Button size="sm" onClick={() => void call("flowpanel.queue.retry", "Retry")}>
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRemoveOpen(true)}
                disabled={deleting}
              >
                Remove
              </Button>
            </div>

            {/* Data */}
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data
              </div>
              <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs overflow-x-auto">
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </div>

            {/* Result */}
            {job.returnvalue !== undefined && job.returnvalue !== null && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Return value
                </div>
                <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs overflow-x-auto">
                  {JSON.stringify(job.returnvalue, null, 2)}
                </pre>
              </div>
            )}

            {/* Failure */}
            {job.failedReason && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-destructive">
                  Failure
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {job.failedReason}
                </div>
                {job.stacktrace && job.stacktrace.length > 0 && (
                  <pre className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs overflow-x-auto">
                    {job.stacktrace.join("\n")}
                  </pre>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove job?"
        description="This permanently deletes the job record."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          setDeleting(true);
          await call("flowpanel.queue.remove", "Remove");
          setDeleting(false);
        }}
      />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={mono ? "mt-0.5 font-mono text-sm" : "mt-0.5 text-sm"}>{value}</div>
    </div>
  );
}
