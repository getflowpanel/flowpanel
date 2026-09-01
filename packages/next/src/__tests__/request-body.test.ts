import { describe, expect, it } from "vitest";
import { readActionObject, readJsonObject } from "../runtime/request-body";

describe("request body limits", () => {
  it("checks the bytes actually read when Content-Length is absent", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
    });

    expect(await readJsonObject(req)).toEqual({ ok: false, reason: "payload-too-large" });
  });

  it("also caps bodies with an unknown content type", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      body: "x".repeat(1024 * 1024 + 1),
    });

    expect(await readActionObject(req)).toEqual({ ok: false, reason: "payload-too-large" });
  });
});

describe("action body parsing", () => {
  it("accepts an empty body when content type is absent", async () => {
    const req = new Request("http://localhost/x", { method: "POST" });

    expect(await readActionObject(req)).toEqual({ ok: true, value: {} });
  });

  it("reports malformed multipart input", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "multipart/form-data" },
      body: "x=1",
    });

    expect(await readActionObject(req)).toEqual({ ok: false, reason: "invalid-form" });
  });

  it("reports malformed JSON input", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    expect(await readActionObject(req)).toEqual({ ok: false, reason: "invalid-json" });
  });

  it("parses URL-encoded input", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "k=v&n=1",
    });

    expect(await readActionObject(req)).toEqual({ ok: true, value: { k: "v", n: "1" } });
  });

  it("parses JSON objects", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });

    expect(await readActionObject(req)).toEqual({ ok: true, value: { a: 1 } });
  });
});
