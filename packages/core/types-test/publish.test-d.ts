import {
  createPublisher,
  type PublisherClient,
  type RedisLike,
  type WorkerPublisherOptions,
} from "@flowpanel/core/publish";
import type { Redis } from "ioredis";
import { expectAssignable, expectError, expectType } from "tsd";

declare const redis: Redis;

expectAssignable<RedisLike>(redis);
expectType<PublisherClient>(createPublisher({ redis }));
expectType<PublisherClient>(createPublisher({ redis: "redis://localhost:6379", keyPrefix: "app" }));
expectAssignable<WorkerPublisherOptions>({
  driver: "redis",
  url: "redis://localhost:6379",
  keyPrefix: "app-production",
  onError: (err: unknown, channel: string) => console.warn(channel, err),
});
expectType<Promise<void>>(
  createPublisher({ redis }).resource("orders", { action: "delete", id: 7 }),
);
expectType<Promise<void>>(createPublisher({ redis }).resource("orders"));
expectError(createPublisher({ redis }).resource("orders", { action: "archive" }));
