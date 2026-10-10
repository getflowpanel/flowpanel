import type * as React from "react";

export function KV({ children }: { children: React.ReactNode }) {
  return (
    <dl className="fp-grid fp-grid-cols-[minmax(0,2fr)_minmax(0,3fr)] fp-gap-x-6 fp-gap-y-2 fp-text-sm sm:fp-grid-cols-[200px_minmax(0,1fr)]">
      {children}
    </dl>
  );
}

export function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="fp-text-soft">{label}</dt>
      <dd className="fp-min-w-0 fp-break-words fp-text-ink">{value}</dd>
    </>
  );
}
