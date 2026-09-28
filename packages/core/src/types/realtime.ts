import type { PublisherOptions } from "../runtime/publish";
import type { ResourceName } from "./registry";

export type RealtimeConfig = PublisherOptions;

/** A channel name, or `{ resource }` for the channel a resource's own changes travel on. */
export type RealtimeTarget = string | { resource: ResourceName };

/** What a widget or dashboard re-renders on: one target or several. */
export type RealtimeOption = RealtimeTarget | readonly RealtimeTarget[];
