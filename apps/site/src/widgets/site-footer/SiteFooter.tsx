import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { flowpanelVersion } from "@/shared/lib/version";

const FOOTER_LINKS: ReadonlyArray<{
  label: string;
  href: string;
  external?: boolean;
}> = [
  { label: "GitHub", href: siteConfig.links.github, external: true },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
  { label: "Issues", href: siteConfig.links.issues, external: true },
];

export function SiteFooter() {
  // Read at render time so a long-lived process picks up year rollover.
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-4 px-6 py-10 font-mono text-xs text-[var(--color-fg-subtle)] md:flex-row md:justify-between">
        <p>
          © {currentYear} {siteConfig.name}
          <span className="mx-2">·</span>MIT
          <span className="mx-2">·</span>v{flowpanelVersion}
        </p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-[var(--color-fg)]"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className="transition-colors hover:text-[var(--color-fg)]">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
