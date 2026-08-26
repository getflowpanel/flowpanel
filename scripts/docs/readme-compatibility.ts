import { readCompatibility } from "../../apps/site/src/shared/lib/compatibility";

export const README_COMPATIBILITY_START = "<!-- flowpanel:compatibility:start -->";
export const README_COMPATIBILITY_END = "<!-- flowpanel:compatibility:end -->";

export function renderReadmeCompatibility(root: string): string {
  const rows = readCompatibility(root).map((item) => `| ${item.requirement} | \`${item.range}\` |`);
  return [
    README_COMPATIBILITY_START,
    "| Requirement | Supported range |",
    "| --- | --- |",
    ...rows,
    README_COMPATIBILITY_END,
  ].join("\n");
}
