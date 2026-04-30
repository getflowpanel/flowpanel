export interface Publisher {
  publish(channel: string, payload?: unknown): Promise<void>;
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
}

export interface PublisherOptions {
  driver: "memory";
}

export function createPublisher(_opts: PublisherOptions): Publisher {
  const subs = new Map<string, Set<(p: unknown) => void>>();

  return {
    async publish(channel, payload) {
      const handlers = subs.get(channel);
      if (!handlers) return;
      for (const h of handlers) h(payload);
    },
    subscribe(channel, handler) {
      let handlers = subs.get(channel);
      if (!handlers) {
        handlers = new Set();
        subs.set(channel, handlers);
      }
      handlers.add(handler);
      return () => {
        handlers?.delete(handler);
        if (handlers?.size === 0) subs.delete(channel);
      };
    },
  };
}
