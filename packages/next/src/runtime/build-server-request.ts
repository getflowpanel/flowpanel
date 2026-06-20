import { cookies, headers } from "next/headers";

export async function buildServerRequest(url: string | URL): Promise<Request> {
  const [incomingHeaders, cookieStore] = await Promise.all([headers(), cookies()]);

  const outHeaders = new Headers(incomingHeaders);
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) outHeaders.set("cookie", cookieHeader);

  return new Request(url, { headers: outHeaders });
}
