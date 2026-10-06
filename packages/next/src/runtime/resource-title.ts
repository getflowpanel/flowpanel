import type { ResourceConfig } from "@flowpanel/core";
import { formatLabel, humanize } from "@flowpanel/core";

const SAME_IN_BOTH = new Set(["news", "series", "species", "data", "media", "metadata", "info"]);
const IRREGULAR: Record<string, string> = { people: "person", children: "child", men: "man" };

function singularWord(word: string): string {
  const lower = word.toLowerCase();
  if (SAME_IN_BOTH.has(lower)) return word;
  const irregular = IRREGULAR[lower];
  if (irregular) return word.charAt(0) + irregular.slice(1);
  if (/[^aeiou]ies$/i.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ss|sh|ch|x|zz|tus|sus)es$/i.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/i.test(word) || !/s$/i.test(word)) return word;
  return word.slice(0, -1);
}

/** "users" reads "User", "order_items" reads "Order item". */
export function humanizeSingular(name: string): string {
  const words = humanize(name).split(" ");
  const last = words.pop();
  return last === undefined ? "" : [...words, singularWord(last)].join(" ");
}

/** Name for a single row: `labelOne`, then `label`, then the resource name made singular and readable. */
export function singularLabel(resource: ResourceConfig, name: string): string {
  return resource.options.labelOne ?? resource.options.label ?? humanizeSingular(name);
}

/** Name for the collection: the sidebar entry, the list heading and the detail crumb. */
export function pluralLabel(resource: ResourceConfig, name: string): string {
  return resource.options.plural ?? resource.options.label ?? humanize(name);
}

/** The collection name mid-sentence: "Search customers…", while "API keys" keeps its capitals. */
export function labelInSentence(label: string): string {
  return /^\p{Lu}\p{Ll}/u.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** A one-row heading such as "New {label}": "New user"; after punctuation or first, the label stays as written. */
export function singularTitle(template: string, resource: ResourceConfig, name: string): string {
  const label = singularLabel(resource, name);
  const midSentence = /\p{L} \{label\}/u.test(template);
  return formatLabel(template, { label: midSentence ? labelInSentence(label) : label });
}
