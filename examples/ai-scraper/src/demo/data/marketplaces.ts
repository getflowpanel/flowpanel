import type { Marketplace } from "./types";

export const MARKETPLACE_LABELS: Readonly<Record<Marketplace, string>> = {
  amazon: "Amazon",
  best_buy: "Best Buy",
  ebay: "eBay",
  newegg: "Newegg",
  walmart: "Walmart",
  media_markt: "MediaMarkt",
  mercado_libre: "Mercado Libre",
};

const labels: Readonly<Record<string, string>> = MARKETPLACE_LABELS;

export const marketplaceLabel = (value: string): string => labels[value] ?? value;
