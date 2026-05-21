import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
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
    ...components,
  };
}
