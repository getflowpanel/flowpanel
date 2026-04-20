export function NumberCell({ value }: { value: unknown }) {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono tabular-nums">{num.toLocaleString()}</span>;
}
