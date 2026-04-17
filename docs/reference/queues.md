# Queues

FlowPanel ships with first-class queue inspection and control. Today there's a BullMQ adapter; the `QueueAdapter` interface makes adding more (pgmq, SQS, Inngest…) a small package.

## BullMQ

```bash
pnpm add @flowpanel/queue-bullmq
```

```ts
import { Queue } from "bullmq";
import { bullmqAdapter } from "@flowpanel/queue-bullmq";
import { defineFlowPanel } from "@flowpanel/core";

const emailQueue = new Queue("email", { connection: { host: "localhost", port: 6379 } });
const webhookQueue = new Queue("webhooks", { connection: { /* … */ } });

export const flowpanel = defineFlowPanel({
  ...,
  queues: {
    email:    bullmqAdapter(emailQueue,   { label: "Email" }),
    webhooks: bullmqAdapter(webhookQueue, { label: "Webhook delivery" }),
  },
});
```

Each queue gets its own entry under the "Queues" sidebar group. The queue page shows:

- **Status strip** — live counts per state (waiting / active / delayed / failed / completed)
- **State filter pills** — quickly narrow the table
- **Job table** — id, name, state badge, attempts, schedule, duration; auto-refreshes every 5s
- **Job detail** — click any row for input, return value, stack trace, and actions (Retry / Remove)
- **Queue controls** — Pause / Resume / Drain buttons when the adapter supports them

## Controls

The UI exposes these operations, wired automatically to the adapter:

| Control | When it appears |
|---|---|
| Pause | `adapter.pause` is defined **and** queue is not already paused |
| Resume | `adapter.resume` is defined **and** queue is paused |
| Drain | `adapter.drain` is defined |
| Retry (per-job) | Job state is `failed` |
| Remove (per-job) | Always (confirms via destructive dialog) |

## The `QueueAdapter` interface

Any queue backend can plug in:

```ts
interface QueueAdapter {
  name: string;
  label?: string;

  getStatus(): Promise<QueueStatus>;
  getJobs(args: { state?, limit?, offset? }): Promise<{ jobs: QueueJob[]; total: number }>;
  getJob(id: string): Promise<QueueJob | null>;

  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;

  pause?(): Promise<void>;
  resume?(): Promise<void>;
  drain?(): Promise<void>;
  clean?(state: "completed" | "failed", olderThanMs?): Promise<number>;
}
```

Optional methods surface or hide themselves in the UI based on the `capabilities` FlowPanel reports to the client. You can partially implement — read-only adapters just omit retry/remove/pause.

## Access

Queue procedures live under `flowpanel.queue.*` on the tRPC router. Apply your usual tRPC middleware for auth/role gating — FlowPanel does not hard-code a separate access model for queues.
