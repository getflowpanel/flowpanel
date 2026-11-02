import { bullmqAdapter } from "@flowpanel/kit/bullmq";
import { emailQueue, scrapeQueue } from "../server/queues";

export const jobs = bullmqAdapter({ email: emailQueue, scrape: scrapeQueue });
