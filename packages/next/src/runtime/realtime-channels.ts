import type { RealtimeOption, RealtimeTarget } from "@flowpanel/core";

/** A realtime channel name: letters, digits and `._:-`, starting with a letter or a digit. */
export const CHANNEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const RESOURCE_PREFIX = "resource.";

/** The resource a `resource.<name>` channel carries, or `null` for any other channel. */
export function channelResource(channel: string): string | null {
  return channel.startsWith(RESOURCE_PREFIX) ? channel.slice(RESOURCE_PREFIX.length) : null;
}

function channelOf(target: RealtimeTarget): string {
  return typeof target === "string" ? target : `${RESOURCE_PREFIX}${target.resource}`;
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
