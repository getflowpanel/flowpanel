/** Matches the eject marker across semver + prerelease + build-metadata shapes. */
export const MARKER_REGEX =
  /^\/\/ flowpanel: ejected @ \d+\.\d+\.\d+(?:[-+][\w.-]+)? — this file is yours/;

/** Prepend a marker header to source. Always ends the marker line with a newline. */
export function stampMarker(source: string, version: string): string {
  return `// flowpanel: ejected @ ${version} — this file is yours\n${source}`;
}

/** Detect whether a file has been stamped as ejected. */
export function hasMarker(source: string): boolean {
  return MARKER_REGEX.test(source);
}
