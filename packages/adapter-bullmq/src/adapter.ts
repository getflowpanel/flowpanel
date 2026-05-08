import type { Queue } from "bullmq";

export interface BullMQAdapterOptions {
  queues: Record<string, Queue>;
}

export interface BullMQAdapter {
  kind: "bullmq";
  queues: Record<string, Queue>;
}

/**
 * Wrap a set of BullMQ Queue instances into a FlowPanel BullMQ adapter.
 * Pair with `queue(adapter.queues.<key>, { label, boardUrl })` per queue in
 * your admin config.
 */
export function bullmqAdapter(queues: Record<string, Queue>): BullMQAdapter {
  return { kind: "bullmq", queues };
}
