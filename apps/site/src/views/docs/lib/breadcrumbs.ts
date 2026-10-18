import { findParent } from "fumadocs-core/page-tree";
import { source } from "@/shared/lib/source";
import type { BreadcrumbItem } from "../ui/Breadcrumbs";

export interface DocSection {
  name: string;
  url: string;
}

/** The sidebar folder that lists the page, with the URL of its first page. */
export function findDocSection(pageUrl: string): DocSection | null {
  const folder = findParent(source.pageTree, pageUrl);
  if (folder?.type !== "folder" || typeof folder.name !== "string") return null;
  const first = folder.index ?? folder.children.find((child) => child.type === "page");
  return first?.type === "page" ? { name: folder.name, url: first.url } : null;
}

// Only the doc-specific tail; Breadcrumbs prepends the site crumbs.
export function buildDocBreadcrumbs(pageUrl: string, pageTitle: string): BreadcrumbItem[] {
  const section = findDocSection(pageUrl);
  if (!section || section.name === pageTitle) return [{ label: pageTitle }];
  // Section folders have no index pages, so the section crumb is a plain label.
  return [{ label: section.name }, { label: pageTitle }];
}
