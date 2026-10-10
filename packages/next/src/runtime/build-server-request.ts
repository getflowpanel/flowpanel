import { cookies, headers } from "next/headers";
import { connection } from "next/server";

/** The incoming request as a `Request`; it waits for a real request, so a prerender never runs past it. */
export async function buildServerRequest(url: string | URL): Promise<Request> {
  await connection();
  const [incomingHeaders, cookieStore] = await Promise.all([headers(), cookies()]);

  const outHeaders = new Headers(incomingHeaders);
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) outHeaders.set("cookie", cookieHeader);

  return new Request(url, { headers: outHeaders });
}
