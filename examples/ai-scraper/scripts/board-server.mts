import { startBoardServer } from "@flowpanel/kit/bullmq/board";
import { liveQueues, queuesByName } from "../src/lib/queues";

const port = Number(process.env.BOARD_PORT ?? 3001);

if (liveQueues.length === 0) {
  console.error("No queues configured — set REDIS_URL before starting the board.");
  process.exit(1);
}

// This port is outside the admin — FlowPanel's `auth.access` does not reach it.
const secret = process.env.BOARD_SECRET ?? "";
if (!secret) {
  console.error("BOARD_SECRET is required — the board exposes destructive job controls.");
  process.exit(1);
}

const server = startBoardServer({
  queues: queuesByName,
  port,
  auth: { secret },
  trustedProxies: Number(process.env.BOARD_TRUSTED_PROXIES ?? 0),
});
console.log(`bull-board listening on http://localhost:${port}`);

function shutdown() {
  server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
