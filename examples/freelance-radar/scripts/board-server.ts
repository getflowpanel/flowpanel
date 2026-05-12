import { startBoardServer } from "@flowpanel/adapter-bullmq";
import { queues } from "../src/lib/queues.js";

const port = Number(process.env.BOARD_PORT ?? 3001);

if (Object.keys(queues).length === 0) {
  console.error("No queues configured — set REDIS_URL before starting the board.");
  process.exit(1);
}

const server = startBoardServer({ queues, port });
console.log(`bull-board listening on http://localhost:${port}`);

function shutdown() {
  server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
