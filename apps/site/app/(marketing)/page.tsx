import type { Metadata } from "next";
import { ogImages } from "@/shared/lib/og-image";
import { siteConfig } from "@/shared/lib/site-config";
import { flowpanelVersion } from "@/shared/lib/version";
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

const software = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FlowPanel",
  description: siteConfig.seo.description,
  url: siteConfig.url,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js",
  softwareVersion: flowpanelVersion,
  license: "https://opensource.org/licenses/MIT",
  codeRepository: siteConfig.repo.url,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={software} />
      <Landing />
    </>
  );
}
