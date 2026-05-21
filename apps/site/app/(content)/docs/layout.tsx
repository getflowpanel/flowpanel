import type { ReactNode } from "react";
import { source } from "@/shared/lib/source";
import { DocsLayoutShell } from "@/views/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsLayoutShell tree={source.pageTree}>{children}</DocsLayoutShell>;
}
