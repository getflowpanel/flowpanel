export function StagePill({ stage, color }: { stage: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        background: `${color}22`,
        color,
        fontSize: 11,
        fontWeight: 600,
      }}
      title={`Stage: ${stage}`}
    >
      {stage}
    </span>
  );
}
