import type { RealtimeOption, RealtimeTarget } from "@flowpanel/core";

function channelOf(target: RealtimeTarget): string {
  return typeof target === "string" ? target : `resource.${target.resource}`;
}

function isList(value: RealtimeOption): value is readonly RealtimeTarget[] {
  return Array.isArray(value);
}

/** Channel names for a `realtime` option; `{ resource }` is that resource's own channel. */
export function realtimeChannels(value: RealtimeOption | undefined): string | string[] | undefined {
  if (value === undefined) return undefined;
  return isList(value) ? value.map(channelOf) : channelOf(value);
}

/** `{ realtime }` for a client prop or a drawer wire, or nothing when nothing is subscribed. */
export function realtimeProp(value: RealtimeOption | undefined): { realtime?: string | string[] } {
  const channels = realtimeChannels(value);
  return channels ? { realtime: channels } : {};
}
