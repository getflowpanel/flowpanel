/**
 * The origin the browser addressed, which is not always the one the handler sees:
 * behind a reverse proxy `req.url` carries the internal host. Forwarded headers win
 * when present — a cross-site browser request cannot set them without a preflight.
 */
export function browserOrigin(req: Request): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));
  const url = new URL(req.url);
  if (!host) return url.origin;
  const proto = first(req.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
