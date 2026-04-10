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
        marginTop: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--fp-text-3)",
        }}
      >
        {label}
      </span>
      {meta && (
        <span style={{ fontSize: 12, color: "var(--fp-text-3)", fontWeight: 400 }}>{meta}</span>
      )}
    </div>
  );
}
