export interface ReviewOutcome {
  label: string;
  count: number;
  share: number;
  tone: "default" | "warn";
}

export interface ReviewQueueProps {
  pending: number;
  outcomes: ReviewOutcome[];
}

export function ReviewQueue({ pending, outcomes }: ReviewQueueProps) {
  return (
    <section
      aria-labelledby="review-queue-title"
      className="flex h-full flex-col overflow-hidden rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 shadow-fp-xs"
    >
      <header className="border-b border-fp-border-1 px-4 py-3">
        <h2 id="review-queue-title" className="text-sm font-semibold text-fp-text-1">
          Review queue
        </h2>
        <p className="mt-0.5 text-xs text-fp-text-3">AI matching decisions that need oversight</p>
      </header>

      <div className="px-4 py-4">
        <p className="text-xs text-fp-text-3">Awaiting a decision</p>
        <div className="mt-1 flex items-baseline gap-2">
          <strong className="text-3xl font-semibold tracking-tight tabular-nums text-fp-warn-text">
            {pending.toLocaleString()}
          </strong>
          <span className="text-sm text-fp-text-2">matches</span>
        </div>
      </div>

      <dl className="mt-auto divide-y divide-fp-border-1 border-t border-fp-border-1 px-4">
        {outcomes.map((outcome) => (
          <div key={outcome.label} className="flex items-center gap-3 py-2.5 text-sm">
            <dt className="min-w-0 flex-1 text-fp-text-2">{outcome.label}</dt>
            <dd
              className={`tabular-nums ${outcome.tone === "warn" ? "text-fp-warn-text" : "text-fp-text-1"}`}
            >
              {outcome.count.toLocaleString()}
            </dd>
            <dd className="w-10 text-right text-xs tabular-nums text-fp-text-3">
              {outcome.share}%
            </dd>
          </div>
        ))}
      </dl>

      <a
        href="/admin/matches"
        className="border-t border-fp-border-1 px-4 py-3 text-sm font-medium text-fp-accent transition-colors hover:bg-fp-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fp-focus/40"
      >
        Open review queue <span aria-hidden>→</span>
      </a>
    </section>
  );
}
