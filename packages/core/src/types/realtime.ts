import type { PublisherOptions } from "../runtime/publish";
import type { AccessRule } from "./policy";
import type { ResourceName } from "./registry";

/** Who may subscribe to one of your own channels, and whether its payload is safe across tenants. */
export interface RealtimeChannel {
  /** Who may subscribe. Default: everyone `auth.access` admits. */
  access?: AccessRule;
  /**
   * The payload carries nothing tenant-specific. Under an admin-wide `scope`, a channel without it
   * delivers `{}`, so subscribers only learn that something changed.
   * @defaultValue false
   */
  tenantSafe?: boolean;
}

/** The realtime transport, and the channels of your own the stream may serve. */
export type RealtimeConfig = PublisherOptions & {
  /**
   * Every channel other than `resource.<name>` the browser may subscribe to. The stream refuses
   * an undeclared channel, and `defineAdmin` refuses a widget or list that subscribes to one.
   */
  channels?: Record<string, RealtimeChannel>;
};

/** A channel name, or `{ resource }` for the channel a resource's own changes travel on. */
export type RealtimeTarget = string | { resource: ResourceName };

/** What a widget or dashboard re-renders on: one target or several. */
export type RealtimeOption = RealtimeTarget | readonly RealtimeTarget[];
