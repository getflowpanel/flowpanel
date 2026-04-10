interface ErrorListProps {
  data: Array<{ errorClass: string; count: number }>;
}

export function ErrorListSection({ data }: ErrorListProps) {
  if (data.length === 0) return null;

  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.06)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {data.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: i < data.length - 1 ? "1px solid rgba(239, 68, 68, 0.12)" : undefined,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--fp-font-mono)",
              color: "#ef4444",
            }}
          >
            {item.errorClass}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--fp-font-mono)",
              color: "#ef4444",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "2px 8px",
              borderRadius: 10,
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
