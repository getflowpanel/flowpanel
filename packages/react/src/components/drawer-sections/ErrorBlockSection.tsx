interface ErrorBlockProps {
  data: { errorClass: string; message: string; stack?: string };
}

export function ErrorBlockSection({ data }: ErrorBlockProps) {
  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.06)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--fp-font-mono)",
          color: "#ef4444",
          marginBottom: 6,
        }}
      >
        {data.errorClass}
      </div>
      <div
        style={{
          fontSize: 12,
          fontFamily: "var(--fp-font-mono)",
          color: "var(--fp-text-2)",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {data.message}
      </div>
      {data.stack && (
        <details
          style={{
            marginTop: 10,
          }}
        >
          <summary
            style={{
              fontSize: 11,
              color: "var(--fp-text-3)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Stack trace
          </summary>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              fontSize: 11,
              fontFamily: "var(--fp-font-mono)",
              color: "var(--fp-text-3)",
              background: "rgba(0, 0, 0, 0.15)",
              borderRadius: 6,
              overflow: "auto",
              maxHeight: 200,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {data.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
