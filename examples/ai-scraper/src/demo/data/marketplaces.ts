export const marketplaceLabel = (value: string): string =>
  value
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
