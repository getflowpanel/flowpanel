import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Queue } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";
import { startBoardServer } from "../board";

const SECRET = "board-secret";
// A stand-in bull-board accepts without opening a Redis connection.
const fake = (name: string) =>
  ({ name, opts: {}, metaValues: { version: "bullmq:6" } }) as unknown as Queue;
const email = fake("email");
const payments = fake("payments");

/** The link the admin's queue page builds: `link.<key>.<expires>.<HMAC-SHA256 base64url>`. */
function link(key: string, secondsLeft = 60, secret = SECRET): string {
  const payload = `link.${key}.${Math.floor(Date.now() / 1000) + secondsLeft}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

describe("startBoardServer", () => {
  const servers: Array<ReturnType<typeof startBoardServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
    );
  });

  async function listen(opts: Partial<Parameters<typeof startBoardServer>[0]> = {}) {
    const server = startBoardServer({
      queues: { email, payments },
      port: 0,
      auth: { secret: SECRET },
      ...opts,
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function sessionCookie(res: Response): string {
    return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  }

  it("throws when auth.secret is missing, naming what replaced auth.token", () => {
    expect(() => startBoardServer({ queues: {}, port: 0 } as never)).toThrow(/auth\.secret/);
    expect(() => startBoardServer({ queues: {}, port: 0, auth: { token: "x" } } as never)).toThrow(
      /auth\.token/,
    );
  });

  it("binds to 127.0.0.1 (loopback) by default, and to an explicit bindHost", async () => {
    expect(await listen()).toContain("127.0.0.1");
    const server = startBoardServer({
      queues: {},
      port: 0,
      bindHost: "0.0.0.0",
      auth: { secret: SECRET },
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    expect((server.address() as AddressInfo).address).toBe("0.0.0.0");
  });

  it("SECURITY: rejects a request without a link, cookie or bearer", async () => {
    expect((await fetch(`${await listen()}/`)).status).toBe(401);
  });

  it("opens with a signed link for one of its queues and mints a session cookie", async () => {
    const res = await fetch(`${await listen()}/?fp_board=${link("email")}`);
    expect(res.status).not.toBe(401);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^flowpanel_board_session=session\.email%3A\d+\.\d+\./);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=3600/i);
    expect(setCookie).not.toContain(SECRET);
  });

  it("SECURITY: rejects an expired, forged, foreign or raw-secret link", async () => {
    const base = await listen();
    for (const token of [
      link("email", -1),
      link("email", 60, "other-secret"),
      link("billing"),
      `${link("email").slice(0, -3)}abc`,
      SECRET,
    ]) {
      expect((await fetch(`${base}/?fp_board=${encodeURIComponent(token)}`)).status).toBe(401);
    }
    expect((await fetch(`${base}/?token=${SECRET}`)).status).toBe(401);
  });

  it("authorizes the SPA's link-less sub-requests once the session cookie is set", async () => {
    const base = await listen();
    const cookie = sessionCookie(await fetch(`${base}/queue/email?fp_board=${link("email")}`));
    expect((await fetch(`${base}/`)).status).toBe(401);
    expect((await fetch(`${base}/`, { headers: { cookie } })).status).not.toBe(401);
  });

  it("SECURITY: rejects a forged session cookie or one minted by another board", async () => {
    const base = await listen();
    const other = await listen({ auth: { secret: "other-secret" } });
    const foreign = sessionCookie(
      await fetch(`${other}/?fp_board=${link("email", 60, "other-secret")}`),
    );
    for (const cookie of [
      "flowpanel_board_session=session.email.99999999999.abc",
      `flowpanel_board_session=${link("email")}`,
      `flowpanel_board_session=${SECRET}`,
      foreign,
    ]) {
      expect((await fetch(`${base}/`, { headers: { cookie } })).status).toBe(401);
    }
  });

  it("accepts the secret as a bearer token from a reverse proxy", async () => {
    const res = await fetch(`${await listen()}/`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(res.status).not.toBe(401);
  });

  it("marks the cookie Secure behind a trusted TLS-terminating proxy only", async () => {
    const headers = { "x-forwarded-proto": "https" };
    const direct = await fetch(`${await listen()}/?fp_board=${link("email")}`, { headers });
    expect(direct.headers.get("set-cookie")).not.toMatch(/Secure/i);
    const proxied = await fetch(
      `${await listen({ trustedProxies: 1 })}/?fp_board=${link("email")}`,
      {
        headers,
      },
    );
    expect(proxied.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("SECURITY: a session reaches only the queues its links were signed for", async () => {
    const base = await listen();
    const cookie = sessionCookie(await fetch(`${base}/queue/email?fp_board=${link("email")}`));
    const forged = { cookie, "x-flowpanel-board-queues": "*" };
    expect((await fetch(`${base}/api/queues/payments/metrics`, { headers: forged })).status).toBe(
      404,
    );
    expect(
      (await fetch(`${base}/api/queues/email/metrics`, { headers: { cookie } })).status,
    ).not.toBe(404);
    const both = sessionCookie(
      await fetch(`${base}/queue/payments?fp_board=${link("payments")}`, { headers: { cookie } }),
    );
    expect(
      (await fetch(`${base}/api/queues/payments/metrics`, { headers: { cookie: both } })).status,
    ).not.toBe(404);
    expect(
      (await fetch(`${base}/api/queues/email/metrics`, { headers: { cookie: both } })).status,
    ).not.toBe(404);
  });

  it("verifies with any listed secret, so the secret can rotate", async () => {
    const base = await listen({ auth: { secret: ["new-secret", SECRET] } });
    expect((await fetch(`${base}/?fp_board=${link("email")}`)).status).not.toBe(401);
    expect((await fetch(`${base}/?fp_board=${link("email", 60, "new-secret")}`)).status).not.toBe(
      401,
    );
  });

  function signedSession(entries: Array<[string, number]>, secret = SECRET): string {
    const latest = Math.max(...entries.map(([, expires]) => expires));
    const list = entries.map(([name, expires]) => `${name}:${expires}`).join(",");
    const payload = `session.${list}.${latest}`;
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    return `flowpanel_board_session=${encodeURIComponent(`${payload}.${signature}`)}`;
  }

  it("refreshes only the queue a link names, so one queue never keeps another alive", async () => {
    const base = await listen();
    const soon = Math.floor(Date.now() / 1000) + 5;
    const res = await fetch(`${base}/queue/payments?fp_board=${link("payments")}`, {
      headers: { cookie: signedSession([["email", soon]]) },
    });
    const value = decodeURIComponent(sessionCookie(res).split("=")[1] ?? "");
    expect(value).toContain(`email:${soon},payments:`);
  });

  it("drops a queue whose own hour has passed", async () => {
    const base = await listen();
    const now = Math.floor(Date.now() / 1000);
    const cookie = signedSession([
      ["email", now - 1],
      ["payments", now + 600],
    ]);
    expect((await fetch(`${base}/api/queues/email/metrics`, { headers: { cookie } })).status).toBe(
      404,
    );
    expect(
      (await fetch(`${base}/api/queues/payments/metrics`, { headers: { cookie } })).status,
    ).not.toBe(404);
  });

  it("keeps Redis-wide and cross-queue reads from a scoped session", async () => {
    const base = await listen();
    const cookie = sessionCookie(await fetch(`${base}/?fp_board=${link("email")}`));
    expect((await fetch(`${base}/api/redis/stats`, { headers: { cookie } })).status).toBe(404);
    expect(
      (await fetch(`${base}/api/metrics/history?queue=payments`, { headers: { cookie } })).status,
    ).toBe(404);
  });

  it("answers 401, not 500, to a cookie that is not valid percent-encoding", async () => {
    const base = await listen();
    const res = await fetch(`${base}/`, {
      headers: { cookie: "flowpanel_board_session=%E0%A4%A" },
    });
    expect(res.status).toBe(401);
  });
});
