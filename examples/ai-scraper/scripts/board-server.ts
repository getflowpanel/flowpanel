import { startBoardServer } from "@flowpanel/adapter-bullmq/board";
import { liveQueues, queuesByName } from "../src/lib/queues.js";

const port = Number(process.env.BOARD_PORT ?? 3001);

if (liveQueues.length === 0) {
  console.error("No queues configured — set REDIS_URL before starting the board.");
  process.exit(1);
}

// This port is outside the admin — FlowPanel's `requireRole` does not reach it.
const token = process.env.BOARD_TOKEN;
if (!token) {
  console.error("BOARD_TOKEN is required — the board exposes destructive job controls.");
  process.exit(1);
}

const server = startBoardServer({ queues: queuesByName, port, auth: { token } });
console.log(`bull-board listening on http://localhost:${port}`);

function shutdown() {
  server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
