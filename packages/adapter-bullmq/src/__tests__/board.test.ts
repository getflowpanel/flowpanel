import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startBoardServer } from "../board";

describe("startBoardServer", () => {
  const servers: Array<ReturnType<typeof startBoardServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
    );
  });

  async function listen(opts: Parameters<typeof startBoardServer>[0]) {
    const server = startBoardServer(opts);
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    return server.address() as AddressInfo;
  }

  it("throws when auth.token is missing", () => {
    expect(() => startBoardServer({ queues: {}, port: 0 } as any)).toThrow(/auth\.token/);
  });

  it("throws when auth.token is an empty string", () => {
    expect(() => startBoardServer({ queues: {}, port: 0, auth: { token: "" } })).toThrow(
      /auth\.token/,
    );
  });

  it("binds to 127.0.0.1 (loopback) by default, not every interface", async () => {
    const addr = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    expect(addr.address).toBe("127.0.0.1");
  });

  it("binds to an explicit bindHost when provided", async () => {
    const addr = await listen({
      queues: {},
      port: 0,
      bindHost: "0.0.0.0",
      auth: { token: "secret" },
    });
    expect(addr.address).toBe("0.0.0.0");
  });

  it("SECURITY: rejects requests with no token", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(401);
  });

  it("SECURITY: rejects requests with the wrong token", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts the correct token via the Authorization header", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { authorization: "Bearer secret" },
    });
    expect(res.status).not.toBe(401);
  });

  it("accepts the correct token via ?token= (iframe-compatible — no custom headers)", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const res = await fetch(`http://127.0.0.1:${port}/?token=secret`);
    expect(res.status).not.toBe(401);
  });

  it("mints a session cookie on the token-bearing document request", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const res = await fetch(`http://127.0.0.1:${port}/?token=secret`);
    const setCookie = res.headers.get("set-cookie") ?? "";

    expect(setCookie).toMatch(/^flowpanel_board_session=[0-9a-f]{64}/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toContain("secret");
  });

  it("authorizes the SPA's tokenless sub-requests once the session cookie is set", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    const doc = await fetch(`http://127.0.0.1:${port}/queue/scrape?token=secret`);
    const cookie = (doc.headers.get("set-cookie") ?? "").split(";")[0] as string;

    // The board's own XHR poll — the iframe never appends ?token= to it.
    expect((await fetch(`http://127.0.0.1:${port}/api/queues`)).status).toBe(401);
    const polled = await fetch(`http://127.0.0.1:${port}/api/queues`, { headers: { cookie } });
    expect(polled.status).toBe(200);
  });

  it("SECURITY: rejects a forged session cookie", async () => {
    const { port } = await listen({ queues: {}, port: 0, auth: { token: "secret" } });
    for (const cookie of [
      "flowpanel_board_session=secret",
      `flowpanel_board_session=${"a".repeat(64)}`,
    ]) {
      const res = await fetch(`http://127.0.0.1:${port}/api/queues`, { headers: { cookie } });
      expect(res.status).toBe(401);
    }
  });

  it("SECURITY: rejects a session cookie minted for a different token", async () => {
    const a = await listen({ queues: {}, port: 0, auth: { token: "token-a" } });
    const b = await listen({ queues: {}, port: 0, auth: { token: "token-b" } });
    const doc = await fetch(`http://127.0.0.1:${a.port}/?token=token-a`);
    const cookie = (doc.headers.get("set-cookie") ?? "").split(";")[0] as string;

    const res = await fetch(`http://127.0.0.1:${b.port}/api/queues`, { headers: { cookie } });
    expect(res.status).toBe(401);
  });
});
