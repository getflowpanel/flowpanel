import type * as React from "react";

export function KV({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-2 text-sm">{children}</dl>;
}

export function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-fp-text-2">{label}</dt>
      <dd className="text-fp-text-1">{value}</dd>
    </>
  );
}
