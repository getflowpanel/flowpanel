import { siteConfig } from "./site-config";
import { flowpanelVersion } from "./version";

const ORGANIZATION_ID = `${siteConfig.url}/#organization`;
const WEBSITE_ID = `${siteConfig.url}/#website`;
const SOFTWARE_ID = `${siteConfig.url}/#software`;

const absolute = (path: string) => new URL(path, siteConfig.url).toString();

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: absolute("/apple-icon"),
        sameAs: ["https://github.com/getflowpanel", "https://www.npmjs.com/org/flowpanel"],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: siteConfig.name,
    description: siteConfig.seo.description,
    url: siteConfig.url,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Admin panel",
    operatingSystem: "Node.js",
    softwareVersion: flowpanelVersion,
    softwareRequirements: "Next.js 15.5 or 16, React 19, Drizzle ORM or Prisma",
    license: "https://opensource.org/licenses/MIT",
    downloadUrl: siteConfig.links.npm,
    screenshot: absolute("/admin-overview-light.png"),
    publisher: { "@id": ORGANIZATION_ID },
    sameAs: [siteConfig.links.github, siteConfig.links.npm],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

interface DocJsonLdInput {
  /** The page title the visible breadcrumbs show. */
  title: string;
  headline: string;
  description: string | undefined;
  url: string;
  image: string;
  section: { name: string; url: string } | null;
}

export function docJsonLd({ title, headline, description, url, image, section }: DocJsonLdInput) {
  const docs = { name: "Docs", url: "/docs/introduction/getting-started" };
  const crumbs = [
    { name: siteConfig.name, url: "/" },
    docs,
    ...(section && section.url !== docs.url ? [section] : []),
    { name: title, url },
  ].filter((crumb, index, all) => all[index + 1]?.url !== crumb.url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline,
        description,
        url: absolute(url),
        mainEntityOfPage: absolute(url),
        image: absolute(image),
        inLanguage: "en",
        isPartOf: { "@id": WEBSITE_ID },
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
        about: { "@id": SOFTWARE_ID },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: absolute(crumb.url),
        })),
      },
    ],
  };
}
