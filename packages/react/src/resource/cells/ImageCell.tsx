export function ImageCell({ value, size = 32 }: { value: unknown; size?: number }) {
  if (!value || typeof value !== "string") return <span className="text-muted-foreground">—</span>;
  return (
    <img
      src={value}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
