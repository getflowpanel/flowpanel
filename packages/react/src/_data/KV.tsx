import type * as React from "react";

export function KV({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-6 gap-y-2 text-sm sm:grid-cols-[200px_minmax(0,1fr)]">
      {children}
    </dl>
  );
}

export function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-fp-text-2">{label}</dt>
      <dd className="min-w-0 break-words text-fp-text-1">{value}</dd>
    </>
  );
}
