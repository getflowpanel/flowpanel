export const ogSize = { width: 1200, height: 630 };

interface OgCardProps {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
}

export function OgCard({ eyebrow, title, subtitle }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#111214",
        padding: "72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: rendered to a PNG by Satori, not real DOM */}
        <svg width="64" height="64" viewBox="0 0 100 100" fill="none">
          <rect x="24" y="24" width="52" height="52" rx="15" stroke="#29ABE2" strokeWidth="8" />
          <path
            d="M12 56C26 44 38 44 50 56C62 68 74 68 88 52"
            stroke="#29ABE2"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 40, fontWeight: 600, color: "#eceef0" }}>FlowPanel</span>
        {eyebrow ? <span style={{ fontSize: 32, color: "#8a8f95" }}>{eyebrow}</span> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <span
          style={{
            fontSize: title.length > 40 ? 64 : 78,
            fontWeight: 700,
            color: "#eceef0",
            letterSpacing: "-2px",
            lineHeight: 1.04,
            maxWidth: "1000px",
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span style={{ fontSize: 30, color: "#a4a8ad", maxWidth: "980px", lineHeight: 1.3 }}>
            {subtitle}
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 26, color: "#eceef0" }}>pnpm dlx @flowpanel/cli init</span>
        <span style={{ fontSize: 26, color: "#8a8f95" }}>flowpanel.tech</span>
      </div>
    </div>
  );
}
