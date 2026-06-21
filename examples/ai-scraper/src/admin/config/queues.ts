import { queue } from "@flowpanel/kit";
import { liveQueues } from "@/src/lib/queues";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const iframeBoardUrl = (name: string) =>
  `http://localhost:3001/queues/${name}?token=${process.env.BOARD_TOKEN ?? ""}`;

export const queues = liveQueues.map((q) =>
  queue(q.instance, { label: label(q.name), boardUrl: iframeBoardUrl(q.name) }),
);
