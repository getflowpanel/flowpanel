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
      className="flex h-full flex-col overflow-hidden rounded-fp-xl border border-fp-border-1 bg-fp-bg-1 shadow-fp-sm"
    >
      <header className="px-5 pt-5 pb-3">
        <h2 id="review-queue-title" className="text-sm font-semibold text-fp-text-1">
          Review queue
        </h2>
        <p className="mt-0.5 text-xs text-fp-text-3">AI matching decisions that need oversight</p>
      </header>

      <div className="px-5 py-3">
        <p className="text-xs text-fp-text-3">Awaiting a decision</p>
        <div className="mt-1 flex items-baseline gap-2">
          <strong className="text-3xl font-semibold tracking-tight tabular-nums text-fp-text-1">
            {pending.toLocaleString()}
          </strong>
          <span className="text-sm text-fp-text-2">matches</span>
        </div>
      </div>

      <dl className="mx-5 mt-auto divide-y divide-fp-border-1 rounded-fp-lg bg-fp-bg-2 px-3">
        {outcomes.map((outcome) => (
          <div key={outcome.label} className="flex items-center gap-3 py-2.5 text-sm">
            <dt className="flex min-w-0 flex-1 items-center gap-2 text-fp-text-2">
              {outcome.tone === "warn" ? (
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-fp-warn" />
              ) : null}
              <span className="truncate">{outcome.label}</span>
            </dt>
            <dd className="tabular-nums text-fp-text-1">{outcome.count.toLocaleString()}</dd>
            <dd className="w-10 text-right text-xs tabular-nums text-fp-text-3">
              {outcome.share}%
            </dd>
          </div>
        ))}
      </dl>

      <a
        href="/admin/matches"
        className="mx-3 mt-3 mb-3 rounded-fp px-3 py-2.5 text-sm font-medium text-fp-accent transition-colors hover:bg-fp-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
      >
        Open review queue <span aria-hidden>→</span>
      </a>
    </section>
  );
}
