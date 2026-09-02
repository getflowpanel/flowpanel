import type { QueueConfig } from "@flowpanel/core";
import { PageHeader } from "@flowpanel/react";

export interface QueuePageProps {
  queue: QueueConfig;
  navigation?: Array<{ label: string; href: string; active: boolean }>;
}

export function QueuePage({ queue, navigation = [] }: QueuePageProps) {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-6">
      <PageHeader title={queue.options.label} />
      {navigation.length > 1 ? (
        <nav
          aria-label="Queue boards"
          className="mt-4 flex shrink-0 gap-1 overflow-x-auto border-b border-fp-border-1"
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`-mb-px min-h-10 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                item.active
                  ? "border-fp-accent text-fp-text-1"
                  : "border-transparent text-fp-text-3 hover:text-fp-text-1"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
      <iframe
        src={queue.options.boardUrl}
        className="mt-4 h-full w-full flex-1 rounded-fp border border-fp-border-1"
        title={`${queue.options.label} queue board`}
      />
    </div>
  );
}
