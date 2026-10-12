export type RateLimitOptions =
  | { driver: "memory"; limit: number; windowMs: number }
  | {
      driver: "redis";
      url: string;
      limit: number;
      windowMs: number;
      keyPrefix?: string;
    };

export interface RateLimiter {
  /** Returns true if the request is allowed; false if the limit is exceeded. */
  check(key: string): Promise<boolean>;
}

export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  if (opts.driver === "memory") return createMemoryLimiter(opts);
  return createRedisLimiter(opts);
}

/** Most distinct keys one memory limiter keeps; when full, expired buckets go first, then the oldest tenth. */
export const MEMORY_LIMITER_MAX_KEYS = 10_000;
const KEEP_AFTER_EVICTION = MEMORY_LIMITER_MAX_KEYS * 0.9;

function createMemoryLimiter(opts: Extract<RateLimitOptions, { driver: "memory" }>): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function makeRoom(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    for (const key of buckets.keys()) {
      if (buckets.size <= KEEP_AFTER_EVICTION) break;
      buckets.delete(key);
    }
  }

  return {
    async check(key) {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        buckets.delete(key);
        if (buckets.size >= MEMORY_LIMITER_MAX_KEYS) makeRoom(now);
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (b.count >= opts.limit) return false;
      b.count += 1;
      return true;
    },
  };
}

/** One round trip: count the hit and make sure the key expires, even one an older version left without a TTL. */
const HIT_SCRIPT = `local count = redis.call("INCR", KEYS[1])
if redis.call("PTTL", KEYS[1]) < 0 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return count`;

function createRedisLimiter(opts: Extract<RateLimitOptions, { driver: "redis" }>): RateLimiter {
  type RedisCtor = new (
    url: string,
  ) => {
    eval: (script: string, numKeys: number, key: string, windowMs: number) => Promise<unknown>;
  };

  let client: InstanceType<RedisCtor> | null = null;
  const prefix = opts.keyPrefix ?? "fp:rl:";

  async function load(): Promise<InstanceType<RedisCtor>> {
    if (client) return client;
    const specifier = "ioredis";
    const mod = (await import(/* webpackIgnore: true */ specifier).catch(() => null)) as
      | { default: RedisCtor }
      | RedisCtor
      | null;
    if (!mod) {
      throw new Error(
        "ioredis is not installed — required for rateLimit.driver='redis'. Run `pnpm add ioredis`.",
      );
    }
    const Ctor: RedisCtor = "default" in mod ? mod.default : mod;
    client = new Ctor(opts.url);
    return client;
  }

  return {
    async check(key) {
      const redis = await load();
      const full = prefix + key;
      const count = Number(await redis.eval(HIT_SCRIPT, 1, full, opts.windowMs));
      return count <= opts.limit;
    },
  };
}
