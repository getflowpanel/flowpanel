const STACK = ["Next.js 16.3+", "React 19", "Drizzle", "Prisma 5–6", "TypeScript"] as const;

export function TrustBar() {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
      <span className="text-[var(--color-fg-subtle)]">Works with</span>
      {STACK.map((item) => (
        <span key={item} className="text-[var(--color-fg-muted)]">
          {item}
        </span>
      ))}
    </div>
  );
}
