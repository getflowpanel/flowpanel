"use client";
import { useAdminTable } from "@flowpanel/react";
import * as React from "react";

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface ResourceListSearchProps {
  placeholder?: string;
}

export function ResourceListSearch({ placeholder = "Search…" }: ResourceListSearchProps) {
  const table = useAdminTable();
  const [draft, setDraft] = React.useState(table.search);
  const lastApplied = React.useRef(table.search);

  React.useEffect(() => {
    if (table.search !== lastApplied.current) {
      lastApplied.current = table.search;
      setDraft(table.search);
    }
  }, [table.search]);

  React.useEffect(() => {
    if (draft === lastApplied.current) return;
    const t = setTimeout(() => {
      lastApplied.current = draft;
      table.setSearch(draft);
    }, 250);
    return () => clearTimeout(t);
  }, [draft, table]);

  return (
    <div className="relative mb-3 max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fp-text-3" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 pl-8 pr-8 text-sm text-fp-text-1 placeholder:text-fp-text-3 focus:border-fp-accent focus:outline-none"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-fp-sm p-1 text-fp-text-3 hover:text-fp-text-1"
        >
          <XIcon className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
