export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform?.startsWith("Mac") || navigator.userAgent?.includes("Mac");
}

export function modKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}
