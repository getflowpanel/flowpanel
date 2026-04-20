export function MoneyCell({ value, currency = "USD" }: { value: unknown; currency?: string }) {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return <span className="text-muted-foreground">—</span>;
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
  return <span className="font-mono tabular-nums">{formatted}</span>;
}
