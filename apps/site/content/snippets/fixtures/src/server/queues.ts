import { emailQueue, type Queue, scrapeQueue } from "../lib/queues";

export { emailQueue, scrapeQueue };

export const queuesByName: Record<string, Queue> = { email: emailQueue, scrape: scrapeQueue };
