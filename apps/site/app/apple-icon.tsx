import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const icon = readFileSync(resolve(process.cwd(), "app/icon.svg")).toString("base64");

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0e16" }}>
      <img src={`data:image/svg+xml;base64,${icon}`} width={180} height={180} alt="" />
    </div>,
    size,
  );
}
