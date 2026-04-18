import { useState } from "react";

interface ErrorBlockData {
  errorClass: string;
  errorMessage: string;
  stackTrace?: string;
}

interface ErrorBlockSectionProps {
  data: ErrorBlockData;
}

export function ErrorBlockSection({ data }: ErrorBlockSectionProps) {
  const [stackExpanded, setStackExpanded] = useState(false);

  if (!data) return null;

  return (
    <div
      style={{
        background: "rgba(239,68,68,0.08)",
        borderLeft: "3px solid var(--fp-err)",
        borderRadius: "0 6px 6px 0",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Error class */}
      <span
        style={{
          fontSize: 12,
          fontFamily: "var(--fp-font-mono, monospace)",
          color: "var(--fp-err)",
          fontWeight: 600,
        }}
      >
        {data.errorClass}
      </span>

      {/* Error message */}
      <span
        style={{
          fontSize: 13,
          fontFamily: "var(--fp-font-mono, monospace)",
          color: "var(--fp-text-2)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {data.errorMessage}
      </span>

      {/* Stack trace toggle */}
      {data.stackTrace && (
        <>
          <button
            type="button"
            onClick={() => setStackExpanded((v) => !v)}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 11,
              color: "var(--fp-text-3)",
              textDecoration: "underline",
              marginTop: 2,
            }}
          >
            {stackExpanded ? "Hide stack" : "Show stack"}
          </button>

          {stackExpanded && (
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                fontFamily: "var(--fp-font-mono, monospace)",
                color: "var(--fp-text-3)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "rgba(0,0,0,0.06)",
                borderRadius: 4,
                padding: "8px 10px",
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {data.stackTrace}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
