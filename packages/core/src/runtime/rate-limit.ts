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

function createMemoryLimiter(opts: Extract<RateLimitOptions, { driver: "memory" }>): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async check(key) {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (b.count >= opts.limit) return false;
      b.count += 1;
      return true;
    },
  };
}

function createRedisLimiter(opts: Extract<RateLimitOptions, { driver: "redis" }>): RateLimiter {
  type RedisCtor = new (
    url: string,
  ) => {
    incr: (key: string) => Promise<number>;
    pexpire: (key: string, ms: number) => Promise<number>;
  };

  let client: InstanceType<RedisCtor> | null = null;
  const prefix = opts.keyPrefix ?? "fp:rl:";

  async function load(): Promise<void> {
    if (client) return;
    // Specifier held in a variable so TypeScript does not statically
    // resolve `ioredis` — it is an optional peer dep and may be absent.
    const specifier = "ioredis";
    const mod = (await import(specifier).catch(() => null)) as
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
  }

  return {
    async check(key) {
      await load();
      const full = prefix + key;
      const count = await client!.incr(full);
      if (count === 1) await client!.pexpire(full, opts.windowMs);
      return count <= opts.limit;
    },
  };
}
