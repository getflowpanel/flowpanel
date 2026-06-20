export interface DownloadPayload {
  filename: string;
  data: string | Blob | Uint8Array;
  mime?: string;
}

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
