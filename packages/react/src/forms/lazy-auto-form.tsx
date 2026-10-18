"use client";
import * as React from "react";
import { ChunkBoundary } from "../lib/chunk-boundary";
import { lazyRetry } from "../lib/lazy-retry";
import { Skeleton } from "../ui/skeleton";
import type { AutoFormProps } from "./AutoForm";

const LoadedAutoForm = lazyRetry<AutoFormProps>(() =>
  import("./AutoForm").then((module) => ({ default: module.AutoForm })),
);

let requested = false;

/** Starts loading the forms' code once, so the next form a page shows takes input at once. */
export function preloadAutoForm(): void {
  if (requested) return;
  requested = true;
  import("./AutoForm").catch(() => {
    requested = false;
  });
}

function FormFieldsSkeleton({ count }: { count: number }) {
  return (
    <div className="fp-space-y-4" aria-busy="true">
      {Array.from({ length: count }, (_, field) => field).map((field) => (
        <div key={field} className="fp-space-y-1.5">
          <Skeleton className="fp-h-4 fp-w-24" />
          <Skeleton className="fp-h-9 fp-w-full" />
        </div>
      ))}
    </div>
  );
}

/** A generated form, whose fields and validation load with the first form a page shows; until then it is inert. */
export function AutoForm(props: AutoFormProps) {
  const count = Math.min(8, Math.max(1, props.fields?.length ?? props.columns?.length ?? 1));
  return (
    <ChunkBoundary>
      <React.Suspense fallback={<FormFieldsSkeleton count={count} />}>
        <LoadedAutoForm {...props} />
      </React.Suspense>
    </ChunkBoundary>
  );
}
