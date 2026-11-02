import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { AutoTypeTable } from "@/shared/lib/type-table";
import { AdapterTab, AdapterTabs } from "@/shared/ui/adapter-tabs";
import { ApiSignature } from "@/shared/ui/api-signature";
import { CliReference } from "@/shared/ui/cli-reference";
import { Compatibility } from "@/shared/ui/compatibility";
import { ThemeSlots } from "@/shared/ui/theme-slots";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  // Fumadocs' img props miss exactOptionalPropertyTypes; the runtime is fine, so cast here.
  return {
    ...(defaultMdxComponents as MDXComponents),
    AdapterTabs,
    AdapterTab,
    ApiSignature,
    CliReference,
    Compatibility,
    ThemeSlots,
    // Property tables generated from the packages' own TypeScript declarations.
    AutoTypeTable,
    // Twoslash hover popups — rendered for ` ```ts twoslash ` blocks.
    Popup,
    PopupContent,
    PopupTrigger,
    ...components,
  };
}
