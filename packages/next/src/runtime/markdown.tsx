import type { ResourceConfig } from "@flowpanel/core";
import { Fragment, type ReactNode } from "react";
import type { FieldRender } from "../drawer/serialize-fields";
import { columnDefs } from "./column-defs";
import { formFieldsOf } from "./form-fields-of";
import { inlineTokens } from "./markdown-inline";

const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/[^/\\])/i;

/** Fields a resource's forms edit as `type: "markdown"`, unless its column renders or formats them itself. */
export function markdownFields(resource: ResourceConfig): ReadonlySet<string> {
  const own = new Set(
    columnDefs(resource).flatMap((column) =>
      column.field && (column.render || column.format !== undefined) ? [column.field] : [],
    ),
  );
  return new Set(
    formFieldsOf(resource)
      .filter((field) => field.type === "markdown" && !own.has(field.name))
      .map((field) => field.name),
  );
}

function inline(text: string): ReactNode[] {
  return inlineTokens(text).map((token) => {
    if (token.kind === "text") return token.text;
    const key = `${token.at}`;
    if (token.kind === "code") {
      return (
        <code key={key} className="fp-rounded-sm fp-bg-fill fp-px-1 fp-font-mono fp-text-[0.9em]">
          {token.text}
        </code>
      );
    }
    if (token.kind === "strong") return <strong key={key}>{inline(token.text)}</strong>;
    if (token.kind === "em") return <em key={key}>{inline(token.text)}</em>;
    return SAFE_HREF.test(token.href) ? (
      <a key={key} href={token.href} rel="noopener noreferrer" className="fp-underline">
        {token.label}
      </a>
    ) : (
      <Fragment key={key}>{token.label}</Fragment>
    );
  });
}

/** A `markdown` field's text as headings, lists and paragraphs; HTML in it stays text. */
export function renderMarkdown(value: unknown): ReactNode {
  if (typeof value !== "string" || value.trim() === "") return null;
  const blocks = value
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  return (
    <div className="fp-space-y-2 fp-break-words">
      {blocks.map((block, index) => {
        const rows = block.split("\n");
        const key = `b${index}`;
        if (rows.every((row) => /^\s*[-*]\s+/.test(row))) {
          return (
            <ul key={key} className="fp-list-disc fp-space-y-1 fp-pl-5">
              {rows.map((row, item) => {
                const itemKey = `${key}-${item}`;
                return <li key={itemKey}>{inline(row.replace(/^\s*[-*]\s+/, ""))}</li>;
              })}
            </ul>
          );
        }
        const heading = /^#{1,6}\s+(.*)$/.exec(rows[0] ?? "");
        if (heading && rows.length === 1) {
          return (
            <p key={key} className="fp-font-semibold">
              {inline(heading[1] ?? "")}
            </p>
          );
        }
        return (
          <p key={key} className="fp-whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

/** A `markdown` field without a render of its own renders its text as markdown. */
export function withMarkdown(
  renders: Map<string, FieldRender>,
  markdown: ReadonlySet<string>,
  readable: ReadonlySet<string>,
): Map<string, FieldRender> {
  const out = new Map(renders);
  for (const name of markdown) {
    if (readable.has(name) && !out.has(name))
      out.set(name, (row: Record<string, unknown>) => renderMarkdown(row[name]));
  }
  return out;
}
