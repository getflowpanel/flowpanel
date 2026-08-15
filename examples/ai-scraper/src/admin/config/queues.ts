import { queue } from "@flowpanel/kit";
import { liveQueues } from "@/src/lib/queues";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// The board is a separate origin the browser must reach, so localhost is only a
// dev default — a deployment must set BOARD_URL or every visitor's iframe points
// at their own machine.
const base = (
  process.env.BOARD_URL ?? `http://localhost:${process.env.BOARD_PORT ?? "3001"}`
).replace(/\/+$/, "");

function iframeBoardUrl(name: string): string {
  const token = process.env.BOARD_TOKEN;
  if (!token) {
    throw new Error(
      "BOARD_TOKEN is required whenever REDIS_URL is set — it is the only guard on the board's destructive job controls.",
    );
  }
  return `${base}/queue/${name}?token=${encodeURIComponent(token)}`;
}

export const queues = liveQueues.map((q) =>
  queue(q.instance, { label: label(q.name), boardUrl: iframeBoardUrl(q.name) }),
);
