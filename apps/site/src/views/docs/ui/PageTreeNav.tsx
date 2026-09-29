"use client";

import type { Node as PageTreeNode } from "fumadocs-core/page-tree";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface PageTreeNavProps {
  items: PageTreeNode[];
}

// Folders nest one level; a deeper tree would need recursion.
export function PageTreeNav({ items }: PageTreeNavProps) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-6">
      {items.map((item) => {
        if (item.type === "separator") {
          return (
            <li
              key={`sep:${asString(item.name)}`}
              className="pt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
            >
              {item.name}
            </li>
          );
        }

        if (item.type === "folder") {
          return (
            <li key={`folder:${asString(item.name)}`}>
              <p className="font-medium text-[var(--color-fg)]">{item.name}</p>
              <ul className="mt-3 flex flex-col">
                {item.children.map((child) => {
                  if (child.type !== "page") return null;
                  return (
                    <PageLink
                      key={child.url}
                      href={child.url}
                      name={asString(child.name)}
                      active={pathname === child.url}
                    />
                  );
                })}
              </ul>
            </li>
          );
        }

        return (
          <li key={item.url}>
            <PageLink href={item.url} name={asString(item.name)} active={pathname === item.url} />
          </li>
        );
      })}
    </ul>
  );
}

interface PageLinkProps {
  href: string;
  name: string;
  active: boolean;
}

function asString(name: PageTreeNode["name"]): string {
  return typeof name === "string" ? name : String(name);
}

function PageLink({ href, name, active }: PageLinkProps) {
  return (
    <li className="relative">
      <Link
        href={href}
        className={[
          "block border-l py-1.5 pl-3 -ml-px transition-colors",
          active
            ? "border-[var(--color-fg)] font-medium text-[var(--color-fg)]"
            : "border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
        ].join(" ")}
      >
        {name}
      </Link>
    </li>
  );
}
