/** `203.0.113.7:51234` and `[2001:db8::1]:443` name the same client as their bare address. */
function withoutPort(entry: string): string {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(entry);
  if (bracketed?.[1]) return bracketed[1];
  return /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(entry)
    ? entry.slice(0, entry.lastIndexOf(":"))
    : entry;
}

/** The `X-Forwarded-For` entry the outermost of `trustedProxies` proxies appended; entries left of it come from the client. */
export function clientIpFrom(headers: Headers, trustedProxies: number): string | null {
  if (trustedProxies < 1) return null;
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const entry = hops[hops.length - trustedProxies];
  return entry === undefined ? null : withoutPort(entry);
}
