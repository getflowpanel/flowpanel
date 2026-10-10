import { createHmac } from "node:crypto";
import type { QueueConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { boardLink, signBoardToken } from "../runtime/board-link";

function queue(options: Partial<QueueConfig["options"]>): QueueConfig {
  return {
    __kind: "queue",
    ref: { name: "email" },
    options: { label: "Email", boardUrl: "http://localhost:3001/queue/email", ...options },
  };
}

describe("the queue page's board link", () => {
  it("is boardUrl unchanged without a boardSecret", async () => {
    expect(await boardLink(queue({}), "email")).toBe("http://localhost:3001/queue/email");
  });

  it("carries a link signed for the queue that expires in a minute, never the secret", async () => {
    const url = new URL(await boardLink(queue({ boardSecret: "s3cret" }), "email"));
    const token = url.searchParams.get("fp_board") ?? "";
    expect(url.toString()).not.toContain("s3cret");
    const [purpose, key, expires, signature] = token.split(".");
    expect(purpose).toBe("link");
    expect(key).toBe("email");
    expect(Number(expires) - Date.now() / 1000).toBeGreaterThan(55);
    expect(Number(expires) - Date.now() / 1000).toBeLessThanOrEqual(60);
    expect(signature).toBe(
      createHmac("sha256", "s3cret").update(`link.email.${expires}`).digest("base64url"),
    );
  });

  it("signs the same token the board server computes", async () => {
    const token = await signBoardToken("k", "jobs.v2", 1_000_000);
    const payload = "link.jobs.v2.1060";
    expect(token).toBe(
      `${payload}.${createHmac("sha256", "k").update(payload).digest("base64url")}`,
    );
  });

  it("signs a relative boardUrl behind the admin's own proxy too", async () => {
    const url = await boardLink(
      queue({ boardUrl: "/board/queue/email?x=1", boardSecret: "s" }),
      "email",
    );
    expect(url).toMatch(/^\/board\/queue\/email\?x=1&fp_board=link\.email\.\d+\.[\w-]+$/);
  });

  it("keeps everything after the first # of boardUrl", async () => {
    const url = await boardLink(
      queue({ boardUrl: "/board/#/queue/a#b", boardSecret: "s" }),
      "email",
    );
    expect(url).toMatch(/^\/board\/\?fp_board=link\.email\.\d+\.[\w-]+#\/queue\/a#b$/);
  });
});
