function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

const OUT_OF_FLOW = /^(?:abs|fix)/;

function inFlow(element: Element): boolean {
  const style = getComputedStyle(element);
  return style.display !== "none" && !OUT_OF_FLOW.test(style.position);
}

/** The page below `from`'s content: boxes laid out under it and parents' bottom padding, never overflow. */
export function spaceBelow(from: HTMLElement): number {
  let below = px(getComputedStyle(from).paddingBottom);
  for (let node: Element = from; node !== document.body; ) {
    const parent = node.parentElement;
    if (!parent) break;
    const bottom = node.getBoundingClientRect().bottom;
    let end = bottom;
    for (let next = node.nextElementSibling; next; next = next.nextElementSibling) {
      if (!inFlow(next)) continue;
      const box = next.getBoundingClientRect();
      if (box.height > 0 && box.top >= bottom - 0.5) {
        end = Math.max(end, box.bottom + px(getComputedStyle(next).marginBottom));
      }
    }
    const style = getComputedStyle(parent);
    below += end - bottom + px(style.paddingBottom) + px(style.borderBottomWidth);
    node = parent;
  }
  return Math.max(0, below);
}
