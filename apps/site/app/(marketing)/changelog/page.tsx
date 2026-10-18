import type { Metadata } from "next";
import { ogImages } from "@/shared/lib/og-image";

export { Changelog as default } from "@/views/changelog";

const description =
  "What changed in each FlowPanel release: new features, fixes and breaking changes in @flowpanel/kit, the CLI and the ESLint plugin, newest first.";

export const metadata: Metadata = {
  title: "Changelog",
  description,
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog · FlowPanel",
    description,
    url: "/changelog",
    siteName: "FlowPanel",
    type: "website",
    images: ogImages,
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog · FlowPanel",
    description,
    images: ogImages,
  },
};
