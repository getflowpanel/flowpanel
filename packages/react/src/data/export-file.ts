export type ExportFormat = "csv" | "json";

/** A file name from a table's label: "Customers" saves as `customers-…`. */
export function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "export";
}
