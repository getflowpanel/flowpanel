import type { bullmqAdapter } from "@flowpanel/kit/bullmq";

export type Queue = Parameters<typeof bullmqAdapter>[0][string];

export declare const emailQueue: Queue;
export declare const scrapeQueue: Queue;

export const queuesByName: Record<string, Queue> = { email: emailQueue, scrape: scrapeQueue };
