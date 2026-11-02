import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TYPES = join(import.meta.dirname, "../types");

describe("realtime options", () => {
  it("take RealtimeOption on every widget and dashboard type", () => {
    const narrow = readdirSync(TYPES, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) =>
        /realtime\?: string \| string\[\]/.test(readFileSync(join(TYPES, file), "utf8")),
      );
    expect(
      narrow,
      "declare `realtime?: RealtimeOption` so `{ resource }` targets type-check",
    ).toEqual([]);
  });
});
