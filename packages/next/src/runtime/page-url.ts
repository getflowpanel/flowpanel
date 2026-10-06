import type { ResolvedAdminConfig } from "@flowpanel/core";
import { connection } from "next/server";
import { cache } from "react";
import { buildServerRequest } from "./build-server-request";
import { buildHref } from "./href";

export type PageParams = Record<string, string | string[] | undefined>;

export function resolveCatchAllSegments(params: PageParams): string[] {
  const slug = params.slug;
  if (Array.isArray(slug)) return slug;
  const rest = params.rest;
  if (Array.isArray(rest)) return rest;
  for (const v of Object.values(params)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

export function toSearchParams(raw: PageParams | undefined): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, item);
    } else if (v !== undefined) {
      sp.set(k, v);
    }
  }
  return sp;
}

const requestFor = cache(async (href: string) => {
  await connection();
  return buildServerRequest(href);
});

/** The page's own path and Request, shared with its metadata in one render so the caller is authenticated and rate-limited once. */
export async function pageRequest(
  config: ResolvedAdminConfig,
  slug: readonly string[],
  sp: URLSearchParams,
): Promise<{ path: string; req: Request }> {
  const path = buildHref(config, ...slug);
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of sp) url.searchParams.append(k, v);
  return { path, req: await requestFor(url.href) };
}
