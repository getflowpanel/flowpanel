import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The kit's `llms/` files — the docs one section or one page at a time — served as generated,
 * so the site and the package cannot disagree. Built once from the repository.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

function directory(): string {
  return path.resolve(process.cwd(), "../../packages/flowpanel/llms");
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export function generateStaticParams(): Array<{ file: string }> {
  const files = existsSync(directory()) ? readdirSync(directory()) : [];
  return files
    .filter((file) => file.endsWith(".txt"))
    .sort()
    .map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  if (!generateStaticParams().some((known) => known.file === file)) return text("Not found\n", 404);
  return text(await readFile(path.join(directory(), file), "utf8"));
}
