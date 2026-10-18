import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Bundler {
  buildSync(options: Record<string, unknown>): { outputFiles: { text: string }[] };
}

const requireCli = createRequire(join(__dirname, "../../../cli/package.json"));
const bundler: Bundler = createRequire(requireCli.resolve("tsx"))("esbuild");

/** Next's router modules as plain stand-ins: a link is an anchor, and navigation does nothing. */
const NEXT_STUB = `
export default function Link({ href, prefetch, children, ...rest }) {
  return <a href={href} {...rest}>{children}</a>;
}
export function useLinkStatus() { return { pending: false }; }
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
export function useRouter() { return router; }
export function usePathname() { return window.location.pathname; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
`;

let cached: string | undefined;

/** The admin fixture as one browser script. */
export function adminFixtureScript(): string {
  if (cached !== undefined) return cached;
  const stub = join(mkdtempSync(join(tmpdir(), "fp-next-stub-")), "next.jsx");
  writeFileSync(stub, NEXT_STUB);
  const result = bundler.buildSync({
    entryPoints: [join(__dirname, "entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "next/link": stub, "next/navigation": stub },
    nodePaths: [join(__dirname, "../../node_modules")],
  });
  cached = result.outputFiles[0]?.text ?? "";
  return cached;
}
