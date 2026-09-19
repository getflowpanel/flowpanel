import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/core", async () => {
  const actual = await vi.importActual<typeof import("@flowpanel/core")>("@flowpanel/core");
  return { ...actual, createPublisher: vi.fn(actual.createPublisher) };
});

import { createPublisher, type Publisher, type ResolvedAdminConfig } from "@flowpanel/core";
import { bindPublisher, resetPublisherForTests } from "../runtime/publish";

type Closeable = Publisher & { close(): Promise<void> };

function fakeConfig(realtime?: unknown): ResolvedAdminConfig {
  return { realtime, resourcesByName: new Map(), __resolved: true } as never;
}

function publisherAt(index: number): Closeable {
  return vi.mocked(createPublisher).mock.results[index]?.value as Closeable;
}

beforeEach(() => {
  vi.mocked(createPublisher).mockClear();
  resetPublisherForTests();
  vi.unstubAllEnvs();
});

afterEach(() => {
  resetPublisherForTests();
  vi.unstubAllEnvs();
});

describe("bindPublisher — rebinding", () => {
  it("rebinds and closes the previous publisher when the realtime options change", async () => {
    bindPublisher(fakeConfig({ driver: "memory" }));
    const first = publisherAt(0);
    const close = vi.spyOn(first, "close");

    bindPublisher(fakeConfig({ driver: "redis", url: "redis://a:6379" }));

    expect(createPublisher).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(close.mock.settledResults[0]?.type).toBe("fulfilled");
    });
  });

  it("rebinds when only the keyPrefix changes", () => {
    bindPublisher(fakeConfig({ driver: "redis", url: "redis://a:6379" }));
    bindPublisher(fakeConfig({ driver: "redis", url: "redis://a:6379", keyPrefix: "acme" }));

    expect(createPublisher).toHaveBeenCalledTimes(2);
  });

  it("does not rebind when a different config object carries identical options", () => {
    const options = { driver: "redis", url: "redis://a:6379", keyPrefix: "acme" };
    bindPublisher(fakeConfig({ ...options }));
    const close = vi.spyOn(publisherAt(0), "close");
    bindPublisher(fakeConfig({ ...options }));

    expect(createPublisher).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("does not rebind for a host client that is the same instance", () => {
    const client = { publish: async () => 1, on: () => undefined };
    bindPublisher(fakeConfig({ driver: "redis", client }));
    bindPublisher(fakeConfig({ driver: "redis", client }));

    expect(createPublisher).toHaveBeenCalledTimes(1);
  });

  it("rebinds for a host client that is a different instance", () => {
    bindPublisher(
      fakeConfig({ driver: "redis", client: { publish: async () => 1, on: () => {} } }),
    );
    const close = vi.spyOn(publisherAt(0), "close");
    bindPublisher(
      fakeConfig({ driver: "redis", client: { publish: async () => 1, on: () => {} } }),
    );

    expect(createPublisher).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("bindPublisher — memory driver diagnostic", () => {
  it("warns once per process when the driver is memory while REDIS_URL is set", () => {
    vi.stubEnv("REDIS_URL", "redis://a:6379");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    bindPublisher(fakeConfig(undefined));
    bindPublisher(fakeConfig({ driver: "memory", keyPrefix: "ignored" }));

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("realtime driver is memory while REDIS_URL is set");
    expect(message).toContain("process.env.REDIS_URL");
    warn.mockRestore();
  });

  it("names FLOWPANEL_REDIS_URL when that is the variable that is set", () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("FLOWPANEL_REDIS_URL", "redis://a:6379");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    bindPublisher(fakeConfig(undefined));

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("while FLOWPANEL_REDIS_URL is set");
    expect(message).toContain("process.env.FLOWPANEL_REDIS_URL");
    expect(message).not.toContain("while REDIS_URL is set");
    warn.mockRestore();
  });

  it("stays quiet when the redis driver is configured, or when no url is in the environment", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    bindPublisher(fakeConfig(undefined));
    expect(warn).not.toHaveBeenCalled();

    vi.stubEnv("REDIS_URL", "redis://a:6379");
    bindPublisher(fakeConfig({ driver: "redis", url: process.env.REDIS_URL }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
