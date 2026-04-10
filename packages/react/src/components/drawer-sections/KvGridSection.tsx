import { useState } from "react";

interface KvGridProps {
  data: Record<string, string | number | null>;
}

function KvRow({ label, value }: { label: string; value: string | number | null }) {
  const [copied, setCopied] = useState(false);
  const displayValue = value === null ? "—" : String(value);

  function handleCopy() {
    if (value === null) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div
      onClick={handleCopy}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid var(--fp-border-1)",
        cursor: value !== null ? "pointer" : "default",
        transition: "background 0.15s ease",
        background: copied ? "rgba(34,197,94,0.08)" : "transparent",
        borderRadius: 4,
      }}
      title={value !== null ? "Click to copy" : undefined}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--fp-text-3)",
          flexShrink: 0,
          marginRight: 16,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: "var(--fp-font-mono)",
          color: copied ? "#22c55e" : "var(--fp-text-1)",
          textAlign: "right",
          wordBreak: "break-all",
          transition: "color 0.15s ease",
        }}
      >
        {copied ? "Copied!" : displayValue}
      </span>
    </div>
  );
}

export function KvGridSection({ data }: KvGridProps) {
  const entries = Object.entries(data);

  return (
    <div
      style={{
        background: "var(--fp-surface-1)",
        border: "1px solid var(--fp-border-1)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {entries.map(([key, value]) => (
        <KvRow key={key} label={key} value={value} />
      ))}
    </div>
  );
}
