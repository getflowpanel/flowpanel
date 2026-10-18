import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";
import { docJsonLd, siteJsonLd, softwareJsonLd } from "./structured-data";

const doc = (url: string, section: { name: string; url: string } | null) =>
  docJsonLd({
    title: "Page",
    headline: "Search title",
    description: undefined,
    url,
    image: `/og${url}/image.png`,
    section,
  })["@graph"];

describe("structured data", () => {
  it("names the site and its publisher once, with stable ids", () => {
    const [organization, website] = siteJsonLd()["@graph"];

    expect(organization).toMatchObject({ "@type": "Organization", name: "FlowPanel" });
    expect(website).toMatchObject({
      "@type": "WebSite",
      url: siteConfig.url,
      publisher: { "@id": organization?.["@id"] },
    });
  });

  it("points a doc at the software by id instead of describing it again", () => {
    const [article] = doc("/docs/guides/permissions", null);

    expect(article).toMatchObject({
      "@type": "TechArticle",
      headline: "Search title",
      image: `${siteConfig.url}/og/docs/guides/permissions/image.png`,
      about: { "@id": softwareJsonLd()["@id"] },
    });
  });

  it("lists a doc's breadcrumbs with absolute URLs and the visible page title", () => {
    const [, breadcrumbs] = doc("/docs/guides/permissions", {
      name: "Production",
      url: "/docs/guides/production-readiness",
    });

    expect(breadcrumbs?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "FlowPanel", item: `${siteConfig.url}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Docs",
        item: `${siteConfig.url}/docs/introduction/getting-started`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Production",
        item: `${siteConfig.url}/docs/guides/production-readiness`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Page",
        item: `${siteConfig.url}/docs/guides/permissions`,
      },
    ]);
  });

  it("never lists the same URL twice in a row", () => {
    const names = (url: string, section: { name: string; url: string }) =>
      doc(url, section)[1]?.itemListElement?.map((item) => item.name);
    const introduction = { name: "Getting started", url: "/docs/introduction/getting-started" };

    expect(names("/docs/introduction/drizzle", introduction)).toEqual([
      "FlowPanel",
      "Docs",
      "Page",
    ]);
    expect(names("/docs/introduction/getting-started", introduction)).toEqual([
      "FlowPanel",
      "Page",
    ]);
  });
});
