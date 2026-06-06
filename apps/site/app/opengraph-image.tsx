import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "flowpanel — the admin panel you don't have to build";

/**
 * Branded social card, generated at build time. No binary asset to maintain;
 * edits live here. Mirrors the site brand: navy surface, blue wave mark.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a0e16",
        backgroundImage:
          "radial-gradient(900px 500px at 85% -10%, rgba(41,171,226,0.18), transparent)",
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
        <span style={{ fontSize: 40, fontWeight: 600, color: "#f3f5f8" }}>flowpanel</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <span
          style={{
            fontSize: 78,
            fontWeight: 700,
            color: "#f3f5f8",
            letterSpacing: "-2px",
            lineHeight: 1.04,
            maxWidth: "920px",
          }}
        >
          The admin panel you don't have to build.
        </span>
        <span style={{ fontSize: 30, color: "#9aa6bd", maxWidth: "880px" }}>
          One typed config becomes a full /admin route for Next.js. Drizzle or Prisma.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: 26, color: "#29ABE2" }}>pnpm dlx @flowpanel/cli init</span>
        <span style={{ fontSize: 26, color: "#566179" }}>· MIT · flowpanel.tech</span>
      </div>
    </div>,
    { ...size },
  );
}
