import { source } from "@/shared/lib/source";
import type { BreadcrumbItem } from "../ui/Breadcrumbs";

// Only the doc-specific tail; Breadcrumbs prepends the site crumbs.
export function buildDocBreadcrumbs(slug: string[], pageTitle: string): BreadcrumbItem[] {
  const sectionSlug = slug[0];
  if (sectionSlug === undefined) {
    return [{ label: pageTitle }];
  }

  const sectionName = lookupSectionName(sectionSlug) ?? toTitle(sectionSlug);
  if (slug.length === 1 || pageTitle === sectionName) {
    return [{ label: sectionName }];
  }

  // Section folders have no index pages, so the section crumb is a plain label.
  return [{ label: sectionName }, { label: pageTitle }];
}

function lookupSectionName(sectionSlug: string): string | null {
  const folder = source.pageTree.children.find(
    (node) =>
      node.type === "folder" &&
      node.children.some(
        (child) => child.type === "page" && child.url.includes(`/${sectionSlug}/`),
      ),
  );
  if (folder && folder.type === "folder" && typeof folder.name === "string") {
    return folder.name;
  }
  return null;
}

function toTitle(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
