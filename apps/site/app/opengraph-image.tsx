import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/shared/ui/og-card";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "FlowPanel: a typed admin panel for Next.js";

export default function OpengraphImage() {
  return new ImageResponse(
    <OgCard
      title="A typed admin panel for Next.js"
      subtitle="Describe your Drizzle or Prisma tables in a typed config."
    />,
    { ...size },
  );
}
