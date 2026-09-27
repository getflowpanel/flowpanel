/** Drop every timeline's `<id>.before` page, which a new filter or range makes stale. */
export function dropTimelinePages(params: URLSearchParams): void {
  for (const key of [...params.keys()]) if (key.endsWith(".before")) params.delete(key);
}
