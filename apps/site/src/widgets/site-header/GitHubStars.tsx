import { Star } from "lucide-react";
import { siteConfig } from "@/shared/lib/site-config";

/**
 * Live GitHub star count for the nav, cached for an hour. On any failure it
 * renders the link with just the star icon (no fabricated number) — honest by
 * design, never a flashing "★ 0".
 */
async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${siteConfig.repo.owner}/${siteConfig.repo.name}`,
      { next: { revalidate: 3600 }, headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export async function GitHubStars() {
  const stars = await getStarCount();
  return (
    <a
      href={siteConfig.links.github}
      target="_blank"
      rel="noreferrer"
      aria-label={`${siteConfig.name} on GitHub${stars !== null ? ` — ${stars} stars` : ""}`}
      className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-fg)]"
    >
      <span className="hidden sm:inline">GitHub</span>
      <Star aria-hidden className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
      {stars !== null && (
        <span className="tabular-nums text-[var(--color-fg-muted)]">{formatCount(stars)}</span>
      )}
    </a>
  );
}
