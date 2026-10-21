import { assertNotReservedName } from "../reserved-names";
import { FlowpanelConfigError } from "../types/config-error";
import type { QueueConfig } from "../types/queue";
import type { RouteNameRegistry } from "./route-graph";

/** Queues by key, each routed once; a `boardSecret` written but empty, such as an unset `process.env.BOARD_SECRET`, adds a warning. */
export function compileQueues(
  queues: readonly QueueConfig[] | undefined,
  routeNames: RouteNameRegistry,
  warnings: string[],
): Map<string, QueueConfig> {
  const queuesByKey = new Map<string, QueueConfig>();
  for (const [index, queue] of (queues ?? []).entries()) {
    const key = queue.options.key ?? queue.ref?.name;
    if (!key) {
      throw new FlowpanelConfigError(
        `queues[${index}]`,
        "the queue has no name to key it by. Set key in its options.",
      );
    }
    if (queuesByKey.has(key)) {
      throw new FlowpanelConfigError(
        `queue "${key}"`,
        "two queues use this key. Give each queue its own key.",
      );
    }
    assertNotReservedName("queue", key, "key");
    routeNames.add("queue", key);
    routeNames.addPath("queue", `/queues/${key}`, key);
    queuesByKey.set(key, queue);
    if ("boardSecret" in queue.options && !queue.options.boardSecret) {
      warnings.push(
        `queue "${key}": boardSecret is empty, so its page cannot sign the board link and the board answers 401. Is BOARD_SECRET set where the admin runs?`,
      );
    }
  }
  return queuesByKey;
}
