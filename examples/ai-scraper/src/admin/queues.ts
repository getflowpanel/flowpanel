import { queue } from "@flowpanel/kit";
import { readSandboxConfig } from "@/src/demo/sandbox/config";
import { liveQueues } from "@/src/lib/queues";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// A deployed board needs a public BOARD_URL; localhost is for development only.
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

// The tokenized board URL grants destructive job controls, so the public demo gets no queues section.
export const queues = readSandboxConfig().publicMode
  ? []
  : liveQueues.map((q) =>
      queue(q.instance, {
        label: label(q.name),
        icon: "workflow",
        boardUrl: iframeBoardUrl(q.name),
        hidden: true,
      }),
    );
