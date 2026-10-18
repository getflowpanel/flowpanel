const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
const FLOWPANEL_LINE = /\[flowpanel\](?:[^"\\<]|\\\\\\"|\\[^"n])*/;
const MAX_LENGTH = 600;

const clip = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);

function nextDataMessage(body: string): string | null {
  const data = NEXT_DATA.exec(body)?.[1];
  if (!data) return null;
  try {
    const message: unknown = JSON.parse(data)?.err?.message;
    return typeof message === "string" && message ? clip(message) : null;
  } catch {
    return null;
  }
}

/** The server's own error in a development 500 body, such as a config error, or `null` when the body hides it. */
export function serverErrorText(body: string): string | null {
  const fromData = nextDataMessage(body);
  if (fromData) return fromData;
  const line = FLOWPANEL_LINE.exec(body)?.[0];
  return line ? clip(line.replace(/\\+"/g, '"')) : null;
}
