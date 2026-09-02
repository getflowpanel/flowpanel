import { readRawDocBody } from "@/shared/lib/raw-doc";
import { source } from "@/shared/lib/source";

interface RouteContext {
  params: Promise<{ slug: string[] }>;
}

/**
 * Returns the raw markdown body of one doc page.
 *
 * URL shape: /api/md/docs/<section>/<slug>
 * Reachable from each doc page via the "View as markdown" link in the
 * right rail — see DocsTocRail.
 *
 * Built once: the body is assembled from repository sources, which the
 * deployed image does not carry.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams().filter((entry) => entry.slug.length > 0);
}

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const { slug } = await params;
  const body = await readRawDocBody(slug);
  if (body === null) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(body, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
