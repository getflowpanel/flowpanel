import type * as schema from "../../db/schema";

export type ListingVariantKind =
  | "exact"
  | "regional_variant"
  | "previous_generation"
  | "refurbished_bundle"
  | "accessory"
  | "contains_product";

export interface ListingVariant {
  kind: ListingVariantKind;
  title: string;
  confidence: number;
  status: "confirmed" | "needs_review" | "rejected";
  priceFactor: number;
}

export interface ProductStory {
  key: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  ourPriceCents: number;
  variants: readonly ListingVariant[];
}

export interface CustomerScenario {
  company: string;
  contactName: string;
  email: string;
  segment: string;
  plan: "starter" | "pro" | "business";
  marketplaces: readonly Marketplace[];
  products: readonly ProductStory[];
}

export const MARKETPLACES = [
  "amazon",
  "best_buy",
  "ebay",
  "newegg",
  "walmart",
  "media_markt",
  "mercado_libre",
] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export type GeneratedRow<Row> = Omit<Row, "sandboxId" | "seedKey">;

export type GeneratedListing = Omit<GeneratedRow<typeof schema.listings.$inferSelect>, "runId"> & {
  runId: number;
};

export interface DemoData {
  customers: GeneratedRow<typeof schema.customers.$inferSelect>[];
  monitors: GeneratedRow<typeof schema.monitors.$inferSelect>[];
  runs: GeneratedRow<typeof schema.runs.$inferSelect>[];
  products: GeneratedRow<typeof schema.products.$inferSelect>[];
  listings: GeneratedListing[];
  matches: GeneratedRow<typeof schema.matches.$inferSelect>[];
  invoices: GeneratedRow<typeof schema.invoices.$inferSelect>[];
  aiUsage: GeneratedRow<typeof schema.aiUsage.$inferSelect>[];
}
