import type { Metadata } from "next";

export { Changelog as default } from "@/views/changelog";

const description = "Release notes for every FlowPanel package, grouped by version.";

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
  },
};
