import type { QueueAdapter, ResolvedQueue, SerializedQueue } from "./types";

/**
 * Resolves a map of queue adapters into ResolvedQueue records keyed by id.
 */
export function resolveQueues(
  queues: Record<string, QueueAdapter> | undefined,
): Record<string, ResolvedQueue> {
  if (!queues) return {};
  const out: Record<string, ResolvedQueue> = {};
  for (const [id, adapter] of Object.entries(queues)) {
    out[id] = {
      id,
      name: adapter.name,
      label: adapter.label ?? titleCase(adapter.name),
      adapter,
    };
  }
  return out;
}

export function serializeQueue(q: ResolvedQueue): SerializedQueue {
  return {
    id: q.id,
    name: q.name,
    label: q.label,
    capabilities: {
      pause: typeof q.adapter.pause === "function",
      resume: typeof q.adapter.resume === "function",
      drain: typeof q.adapter.drain === "function",
      clean: typeof q.adapter.clean === "function",
    },
  };
}

export function serializeQueues(
  queues: Record<string, ResolvedQueue>,
): Record<string, SerializedQueue> {
  return Object.fromEntries(Object.entries(queues).map(([k, q]) => [k, serializeQueue(q)]));
}

function titleCase(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}
