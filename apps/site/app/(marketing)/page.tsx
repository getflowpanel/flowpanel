import type { Metadata } from "next";
import { ogImages } from "@/shared/lib/og-image";
import { siteConfig } from "@/shared/lib/site-config";
import { softwareJsonLd } from "@/shared/lib/structured-data";
import { JsonLd } from "@/shared/ui/json-ld";
import { Landing } from "@/views/landing";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
    url: "/",
    siteName: "FlowPanel",
    type: "website",
    images: ogImages,
  },
};

export default function Page() {
  return (
    <>
      <JsonLd data={softwareJsonLd()} />
      <Landing />
    </>
  );
}
