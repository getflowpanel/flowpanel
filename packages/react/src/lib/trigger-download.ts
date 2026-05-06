export interface DownloadPayload {
  filename: string;
  data: string | Blob | Uint8Array;
  mime?: string;
}

/**
 * Client-only: converts an ActionResult.download payload into a browser file
 * download by creating an object-URL, clicking a temporary anchor, and revoking.
 *
 * Must be called from within an event handler or effect. Throws if `document`
 * is undefined (server-side — guard before invoking).
 */
export function triggerDownload(payload: DownloadPayload): void {
  if (typeof document === "undefined") {
    throw new Error("triggerDownload is client-only");
  }
  const mime = payload.mime ?? "application/octet-stream";
  const blob =
    payload.data instanceof Blob
      ? payload.data
      : new Blob([payload.data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
