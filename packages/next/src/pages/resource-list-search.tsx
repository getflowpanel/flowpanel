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
    aria-hidden="true"
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
    aria-hidden="true"
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
    <div className="fp-relative fp-w-56">
      <SearchIcon className="fp-pointer-events-none fp-absolute fp-left-3 fp-top-1/2 fp-h-3.5 fp-w-3.5 -fp-translate-y-1/2 fp-text-faint" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="fp-h-9 fp-w-full fp-rounded-full fp-border fp-border-line fp-bg-surface fp-pl-9 fp-pr-8 fp-text-sm fp-text-ink fp-shadow-xs fp-transition-colors placeholder:fp-text-faint hover:fp-border-line-strong focus:fp-border-focus focus:fp-outline-none focus:fp-ring-2 focus:fp-ring-focus/25 [&::-webkit-search-cancel-button]:fp-hidden"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="fp-absolute fp-right-2 fp-top-1/2 -fp-translate-y-1/2 fp-rounded-sm fp-p-1 fp-text-faint fp-transition-colors hover:fp-bg-fill/70 hover:fp-text-ink"
        >
          <XIcon className="fp-h-3 fp-w-3" />
        </button>
      ) : null}
    </div>
  );
}
