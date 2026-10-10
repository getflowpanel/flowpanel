import type { QueueConfig, ResolvedLabels } from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core";
import { PageHeader } from "@flowpanel/react";

export interface QueuePageProps {
  queue: QueueConfig;
  navigation?: Array<{ label: string; href: string; active: boolean }>;
  labels: ResolvedLabels["navigation"];
}

export function QueuePage({ queue, navigation = [], labels }: QueuePageProps) {
  return (
    <div className="fp-flex fp-h-[calc(100vh-56px)] fp-flex-col fp-p-6">
      <PageHeader title={queue.options.label} />
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
      <iframe
        src={queue.options.boardUrl}
        className="fp-mt-4 fp-h-full fp-w-full fp-flex-1 fp-rounded fp-border fp-border-line"
        title={formatLabel(labels.queueBoard, { label: queue.options.label })}
      />
    </div>
  );
}
