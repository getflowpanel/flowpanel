import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { AutoTypeTable } from "@/shared/lib/type-table";
import { AdapterTab, AdapterTabs } from "@/shared/ui/adapter-tabs";

/**
 * Registry of components available inside MDX content.
 *
 * Anything exported here can be used directly in `.mdx` files —
 * Fumadocs picks this up via `getMDXComponents` on the doc page.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  // Fumadocs's `defaultMdxComponents.img` props don't satisfy MDX's
  // `exactOptionalPropertyTypes` shape — the runtime behavior is correct,
  // only the optional-property modeling differs. Cast at the boundary.
  return {
    ...(defaultMdxComponents as MDXComponents),
    AdapterTabs,
    AdapterTab,
    // Property tables generated from the packages' own TypeScript declarations.
    AutoTypeTable,
    // Twoslash hover popups — rendered for ` ```ts twoslash ` blocks.
    Popup,
    PopupContent,
    PopupTrigger,
    ...components,
  };
}
