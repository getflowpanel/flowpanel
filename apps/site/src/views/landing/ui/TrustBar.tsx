const STACK = ["Next.js 16", "React 19", "Drizzle", "Prisma", "TypeScript"] as const;

/**
 * "Works with" row under the hero CTAs. Plain wordmarks (no third-party
 * logos), accurate to the documented requirements.
 */
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
