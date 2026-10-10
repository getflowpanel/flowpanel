import { reportListenerError } from "../lib/report-listener-error";
import { backoffDelay, DEFAULT_RECONNECT_MAX_MS } from "./backoff";
import {
  type Callback,
  OFFLINE_AFTER_MS,
  type RealtimeBus,
  type RealtimeStatus,
  type StatusListener,
  type SubscribeOptions,
} from "./context";
import { type RealtimeFrame, readFrame } from "./frame";

/** How long a planned reconnect may take before the status admits it: the server asks for 1 s. */
const QUIET_RECONNECT_MS = 4000;

export interface RealtimeEngineOptions {
  endpoint: string;
  /** Wait this long after the channel set changes before reopening; `0` opens at once. */
  reopenDebounceMs?: number;
  reconnectMaxMs?: number;
  /** A frame arrived; `refresh` is false when every subscriber of its channel only reads payloads. */
  onFrame?: (frame: RealtimeFrame, refresh: boolean) => void;
  /** The stream answers again after a drop, so whatever it missed is stale. */
  onReconnect?: () => void;
}

/** One EventSource for its subscribers' channels; only a frame (or `ready`) makes it live. */
export class RealtimeEngine implements RealtimeBus {
  private readonly counts = new Map<string, number>();
  private readonly refreshCounts = new Map<string, number>();
  private readonly callbacks = new Map<string, Set<Callback>>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly statsListeners = new Set<() => void>();
  private source: EventSource | null = null;
  private activeSig = "";
  private status: RealtimeStatus = "idle";
  private eventCount = 0;
  private attempt = 0;
  private dropped = false;
  /** The server said it is ending this stream on purpose (`closing`), so its end is a quiet reconnect. */
  private closing = false;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set from the first failure until a frame arrives; it turns the status offline. */
  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private reopenTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: RealtimeEngineOptions) {}

  getStatus(): RealtimeStatus {
    return this.status;
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getActiveChannels(): string[] {
    return Array.from(this.counts.keys()).sort();
  }

  getEventCount(): number {
    return this.eventCount;
  }

  subscribeStats(listener: () => void): () => void {
    this.statsListeners.add(listener);
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  subscribe(channels: string[], cb: Callback, options: SubscribeOptions = {}): () => void {
    const list = Array.from(new Set(channels.filter(Boolean)));
    if (list.length === 0) return () => undefined;
    const refresh = options.refresh !== false;
    for (const channel of list) {
      this.counts.set(channel, (this.counts.get(channel) ?? 0) + 1);
      if (refresh) this.refreshCounts.set(channel, (this.refreshCounts.get(channel) ?? 0) + 1);
      let set = this.callbacks.get(channel);
      if (!set) {
        set = new Set();
        this.callbacks.set(channel, set);
      }
      set.add(cb);
    }
    this.scheduleReopen();
    return () => {
      for (const channel of list) {
        decrement(this.counts, channel);
        if (refresh) decrement(this.refreshCounts, channel);
        const set = this.callbacks.get(channel);
        set?.delete(cb);
        if (set?.size === 0) this.callbacks.delete(channel);
      }
      this.scheduleReopen();
    };
  }

  /** Closes the connection and forgets every subscriber. */
  close(): void {
    this.clearTimers();
    this.source?.close();
    this.source = null;
    this.activeSig = "";
    this.counts.clear();
    this.refreshCounts.clear();
    this.callbacks.clear();
    this.statusListeners.clear();
    this.statsListeners.clear();
  }

  private clearTimers(): void {
    this.clearQuiet();
    this.clearOffline();
    if (this.reopenTimer) clearTimeout(this.reopenTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reopenTimer = null;
    this.reconnectTimer = null;
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of Array.from(this.statusListeners)) {
      try {
        listener(next);
      } catch (error) {
        reportListenerError(error);
      }
    }
  }

  private notifyStats(): void {
    for (const listener of Array.from(this.statsListeners)) {
      try {
        listener();
      } catch (error) {
        reportListenerError(error);
      }
    }
  }

  private scheduleReopen(): void {
    const wait = this.options.reopenDebounceMs ?? 50;
    if (wait <= 0) {
      this.open();
      return;
    }
    if (this.reopenTimer) clearTimeout(this.reopenTimer);
    this.reopenTimer = setTimeout(() => {
      this.reopenTimer = null;
      this.open();
    }, wait);
  }

  private open(): void {
    if (typeof window === "undefined") return;
    const channels = this.getActiveChannels();
    const sig = channels.join("|");
    if (this.source && this.activeSig === sig) return;
    const wasLive = this.status === "live";
    this.source?.close();
    this.source = null;
    if (channels.length === 0) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.activeSig = "";
      this.attempt = 0;
      this.clearOffline();
      this.setStatus("idle");
      this.notifyStats();
      return;
    }
    const params = new URLSearchParams();
    for (const channel of channels) params.append("channel", channel);
    // A new channel set on a live stream stays live; the badge does not blink for it.
    if (!wasLive && this.offlineTimer === null && this.status !== "offline") {
      this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    }
    const es = new EventSource(`${this.options.endpoint}?${params.toString()}`);
    this.source = es;
    this.activeSig = sig;
    this.closing = false;
    this.notifyStats();

    es.addEventListener("closing", () => {
      if (this.source === es) this.closing = true;
    });
    es.addEventListener("ready", () => {
      if (this.source === es) this.answered();
    });
    es.onmessage = (event) => {
      if (this.source !== es) return;
      this.answered();
      this.eventCount += 1;
      const frame = readFrame(event.data);
      if (frame) this.dispatch(frame);
      this.notifyStats();
    };
    es.onerror = () => {
      // A superseded source's error is a no-op: only the current source drives the status.
      if (this.source !== es) {
        es.close();
        return;
      }
      this.dropped = true;
      // A stream the server ended on purpose reconnects within a second: stay live through it,
      // and only report the reconnect if no frame comes back in time.
      if (this.closing && es.readyState !== EventSource.CLOSED) {
        this.closing = false;
        this.quietTimer = setTimeout(() => {
          this.quietTimer = null;
          this.attempt += 1;
          this.failing();
        }, QUIET_RECONNECT_MS);
        return;
      }
      this.closing = false;
      this.clearQuiet();
      this.attempt += 1;
      this.failing();
      if (es.readyState !== EventSource.CLOSED) return;
      es.close();
      this.source = null;
      this.activeSig = "";
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(
        () => {
          this.reconnectTimer = null;
          this.open();
        },
        backoffDelay(this.attempt - 1, this.options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS),
      );
    };
  }

  /** Reports `reconnecting`, and `offline` once the failures have lasted `OFFLINE_AFTER_MS`. */
  private failing(): void {
    if (this.status !== "offline") this.setStatus("reconnecting");
    if (this.offlineTimer !== null) return;
    this.offlineTimer = setTimeout(() => this.setStatus("offline"), OFFLINE_AFTER_MS);
  }

  private clearOffline(): void {
    if (this.offlineTimer) clearTimeout(this.offlineTimer);
    this.offlineTimer = null;
  }

  private clearQuiet(): void {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = null;
  }

  private answered(): void {
    this.clearQuiet();
    this.clearOffline();
    this.attempt = 0;
    this.setStatus("live");
    if (!this.dropped) return;
    this.dropped = false;
    this.options.onReconnect?.();
  }

  private dispatch(frame: RealtimeFrame): void {
    const set = this.callbacks.get(frame.channel);
    for (const cb of Array.from(set ?? [])) {
      try {
        cb(frame.payload);
      } catch (error) {
        reportListenerError(error);
      }
    }
    const refresh = set === undefined || (this.refreshCounts.get(frame.channel) ?? 0) > 0;
    this.options.onFrame?.(frame, refresh);
  }
}

function decrement(map: Map<string, number>, key: string): void {
  const count = map.get(key) ?? 0;
  if (count <= 1) map.delete(key);
  else map.set(key, count - 1);
}
