import type { QueueConfig } from "@flowpanel/core";
import { PageHeader } from "@flowpanel/react";

export interface QueuePageProps {
  queue: QueueConfig;
}

export function QueuePage({ queue }: QueuePageProps) {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-6">
      <PageHeader title={queue.options.label} />
      <iframe
        src={queue.options.boardUrl}
        className="mt-4 h-full w-full flex-1 rounded-fp border border-fp-border-1"
        title={`${queue.options.label} queue board`}
      />
    </div>
  );
}
