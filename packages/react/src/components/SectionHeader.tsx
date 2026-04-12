import React from "react";

interface SectionHeaderProps {
  label: string;
  meta?: string;
}

export function SectionHeader({ label, meta }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: "var(--fp-text-5)",
        }}
      >
        {label}
      </span>
      {meta && <span style={{ fontSize: 11, color: "var(--fp-text-4)" }}>{meta}</span>}
    </div>
  );
}
