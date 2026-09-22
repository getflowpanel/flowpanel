export interface FakeNode {
  tag: string;
  attrs?: Record<string, string>;
  children?: FakeNode[];
}

interface Simple {
  tag?: string;
  attrs: Array<[string, string | null]>;
}

function parseSimple(part: string): Simple {
  const tag = /^[a-z]+/.exec(part)?.[0];
  const attrs: Array<[string, string | null]> = [];
  for (const match of part.matchAll(/\[([^\]=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)) {
    attrs.push([match[1] as string, match[2] ?? match[3] ?? match[4] ?? null]);
  }
  return { ...(tag ? { tag } : {}), attrs };
}

/** Descendant-combinator CSS only — the shape a page walker actually writes. */
export function parseSelector(selector: string): Simple[] {
  return selector.trim().split(/\s+/).filter(Boolean).map(parseSimple);
}

function matchesSimple(node: FakeNode, simple: Simple): boolean {
  if (simple.tag && simple.tag !== node.tag) return false;
  return simple.attrs.every(([name, value]) => {
    const actual = node.attrs?.[name];
    if (actual === undefined) return false;
    return value === null || actual === value;
  });
}

function matchesChain(chain: FakeNode[], parts: Simple[]): boolean {
  const target = chain.at(-1);
  const last = parts.at(-1);
  if (!target || !last || !matchesSimple(target, last)) return false;
  let remaining = parts.length - 2;
  for (let index = chain.length - 2; index >= 0 && remaining >= 0; index -= 1) {
    if (matchesSimple(chain[index] as FakeNode, parts[remaining] as Simple)) remaining -= 1;
  }
  return remaining < 0;
}

/** Every node the selector matches, in document order. */
export function query(roots: FakeNode[], selector: string): FakeNode[] {
  const parts = parseSelector(selector);
  const found: FakeNode[] = [];
  const visit = (node: FakeNode, chain: FakeNode[]): void => {
    const next = [...chain, node];
    if (matchesChain(next, parts)) found.push(node);
    for (const child of node.children ?? []) visit(child, next);
  };
  for (const root of roots) visit(root, []);
  return found;
}

export const element = (
  tag: string,
  attrs: Record<string, string>,
  children: FakeNode[] = [],
): FakeNode => ({ tag, attrs, children });
