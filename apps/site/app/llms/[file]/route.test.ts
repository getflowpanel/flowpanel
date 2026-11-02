import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET, generateStaticParams } from "./route";

const KIT_LLMS = path.resolve(process.cwd(), "../../packages/flowpanel/llms");
const generated = readdirSync(KIT_LLMS)
  .filter((file) => file.endsWith(".txt"))
  .sort();

const call = (file: string) =>
  GET(new Request(`http://localhost/llms/${file}`), { params: Promise.resolve({ file }) });

describe("GET /llms/<file>", () => {
  it("serves every file the kit ships, byte for byte", async () => {
    expect(generated).toContain("index.txt");
    for (const file of generated) {
      const response = await call(file);
      expect(response.status, file).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(await response.text()).toBe(readFileSync(path.join(KIT_LLMS, file), "utf8"));
    }
  });

  it("pre-renders exactly those files", () => {
    expect(generateStaticParams().map((param) => param.file)).toEqual(generated);
  });

  it("answers 404 for anything else", async () => {
    expect((await call("nope.txt")).status).toBe(404);
    expect((await call("..%2Fllms.txt")).status).toBe(404);
  });
});
