import { Github } from "lucide-react";
import { siteConfig } from "@/shared/lib/site-config";

export function GitHubLink() {
  return (
    <a
      href={siteConfig.links.github}
      target="_blank"
      rel="noreferrer"
      aria-label={`${siteConfig.name} on GitHub`}
      className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-1 transition-colors hover:text-[var(--color-fg)]"
    >
      <span className="hidden sm:inline">GitHub</span>
      <Github aria-hidden className="h-4 w-4 text-[var(--color-fg-subtle)]" />
    </a>
  );
}
