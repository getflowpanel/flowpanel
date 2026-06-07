import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startBoardServer } from "../board.js";

describe("startBoardServer", () => {
  let server: ReturnType<typeof startBoardServer> | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  async function listen(opts: Parameters<typeof startBoardServer>[0]) {
    server = startBoardServer(opts);
    await new Promise<void>((resolve) => server?.once("listening", () => resolve()));
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
});
