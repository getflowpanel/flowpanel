import type { QueueConfig } from "@flowpanel/core";

/** How long a signed board link opens the board; the board's own session cookie takes over after. */
const LINK_TTL_SECONDS = 60;

/** The query parameter `startBoardServer` reads. */
export const BOARD_LINK_PARAM = "fp_board";

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** `link.<key>.<expires>.<HMAC-SHA256 of the rest>`, the token `startBoardServer` verifies. */
export async function signBoardToken(
  secret: string,
  key: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const expires = Math.floor(nowMs / 1000) + LINK_TTL_SECONDS;
  const payload = `link.${key}.${expires}`;
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(payload));
  return `${payload}.${base64url(signature)}`;
}

/** The iframe URL for a queue page: `boardUrl`, plus a fresh signed link when `boardSecret` is set. */
export async function boardLink(queue: QueueConfig, key: string): Promise<string> {
  const { boardUrl, boardSecret } = queue.options;
  if (!boardSecret) return boardUrl;
  const token = encodeURIComponent(await signBoardToken(boardSecret, key));
  const cut = boardUrl.indexOf("#");
  const path = cut === -1 ? boardUrl : boardUrl.slice(0, cut);
  const hash = cut === -1 ? "" : boardUrl.slice(cut);
  return `${path}${path.includes("?") ? "&" : "?"}${BOARD_LINK_PARAM}=${token}${hash}`;
}
