import type { Marketplace } from "./types";

const LABELS: Readonly<Record<string, string>> = {
  amazon: "Amazon",
  best_buy: "Best Buy",
  ebay: "eBay",
  newegg: "Newegg",
  walmart: "Walmart",
  media_markt: "MediaMarkt",
  mercado_libre: "Mercado Libre",
} satisfies Record<Marketplace, string>;

export const marketplaceLabel = (value: string): string => LABELS[value] ?? value;
