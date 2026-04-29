/**
 * Helpers for the client side of an action round-trip:
 *   - `extractResultData` unwraps the tRPC envelope so callers get the
 *     plain handler return value.
 *   - `triggerDownload` handles `{ download: { filename, content, mimeType } }`
 *     payloads by creating a blob and firing an anchor click.
 *
 * Both are dependency-free so they stay easy to reuse from any button or
 * form that talks to a resource action endpoint.
 */

export function extractResultData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    const r = (raw as { result?: { data?: unknown } }).result;
    if (r && typeof r === "object" && "data" in r) return r.data;
  }
  return raw;
}

export interface ActionDownload {
  filename: string;
  content: string;
  mimeType?: string;
}

export function triggerDownload(dl: ActionDownload): void {
  const blob = new Blob([dl.content], { type: dl.mimeType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dl.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
