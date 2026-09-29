import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FlowPanel — a Next.js admin panel for Drizzle and Prisma";

export default function OpengraphImage() {
  return new ImageResponse(
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <span
          style={{
            fontSize: 78,
            fontWeight: 700,
            color: "#eceef0",
            letterSpacing: "-2px",
            lineHeight: 1.04,
            maxWidth: "920px",
          }}
        >
          The admin panel you don't have to build.
        </span>
        <span style={{ fontSize: 30, color: "#a4a8ad", maxWidth: "880px" }}>
          A typed config, split per resource, becomes a full /admin route for Next.js.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: 26, color: "#eceef0" }}>pnpm dlx @flowpanel/cli init</span>
        <span style={{ fontSize: 26, color: "#8a8f95" }}>· MIT · flowpanel.tech</span>
      </div>
    </div>,
    { ...size },
  );
}
