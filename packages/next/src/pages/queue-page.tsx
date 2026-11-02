import type { ResolvedLabels } from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core";
import { PageHeader } from "@flowpanel/react";

/** Plain values only: the queue's config holds its Redis connection, which the dev renderer would serialize. */
export interface QueuePageProps {
  label: string;
  boardUrl: string;
  navigation?: Array<{ label: string; href: string; active: boolean }>;
  labels: ResolvedLabels["navigation"];
  /** Outside production, why the board will refuse this page: `boardSecret` is written but empty. */
  devNote?: string;
}

export function QueuePage({ label, boardUrl, navigation = [], labels, devNote }: QueuePageProps) {
  return (
    <div className="fp-flex fp-h-[calc(100vh-56px)] fp-flex-col">
      <PageHeader title={label} />
      {navigation.length > 1 ? (
        <nav
          aria-label={labels.queueBoards}
          className="fp-mt-4 fp-flex fp-shrink-0 fp-gap-1 fp-overflow-x-auto fp-border-b fp-border-line"
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`-fp-mb-px fp-min-h-10 fp-whitespace-nowrap fp-border-b-2 fp-px-3 fp-py-2 fp-text-sm fp-font-medium ${
                item.active
                  ? "fp-border-ink fp-text-ink"
                  : "fp-border-transparent fp-text-faint hover:fp-text-ink"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
      {devNote ? (
        <p
          data-fp-dev-note=""
          className="fp-mt-4 fp-max-w-xl fp-rounded fp-border fp-border-line fp-bg-canvas fp-px-4 fp-py-3 fp-text-sm fp-leading-relaxed fp-text-soft"
        >
          {devNote}
        </p>
      ) : (
        <iframe
          src={boardUrl}
          className="fp-mt-4 fp-h-full fp-w-full fp-flex-1 fp-rounded fp-border fp-border-line"
          title={formatLabel(labels.queueBoard, { label })}
        />
      )}
    </div>
  );
}
