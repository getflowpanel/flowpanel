export function JsonCell({ value }: { value: unknown }) {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px] block">
      {str}
    </code>
  );
}
