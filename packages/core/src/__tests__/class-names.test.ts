import { describe, expect, it } from "vitest";
import { cn } from "../class-names";

describe("cn", () => {
  it("lets a later class win a plain Tailwind v3 conflict", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("lets a later class win a Tailwind v4-only conflict", () => {
    expect(cn("inset-shadow-sm", "inset-shadow-md")).toBe("inset-shadow-md");
    expect(cn("inset-ring-1", "inset-ring-2")).toBe("inset-ring-2");
    expect(cn("field-sizing-content", "field-sizing-fixed")).toBe("field-sizing-fixed");
  });

  it("merges prefixed kit classes with each other", () => {
    expect(cn("fp-px-4", "fp-px-2")).toBe("fp-px-2");
    expect(cn("-fp-mt-2", "fp-mt-4")).toBe("fp-mt-4");
    expect(cn("fp-rounded-lg fp-shadow-sm", "fp-rounded fp-shadow-none")).toBe(
      "fp-rounded fp-shadow-none",
    );
  });

  it("lets a host class passed through className replace the kit class it conflicts with", () => {
    expect(cn("fp-px-4", "px-2")).toBe("px-2");
    expect(cn("fp-text-soft", "text-red-600")).toBe("text-red-600");
    expect(cn("fp-text-ink fp-text-sm", "text-red-600")).toBe("fp-text-sm text-red-600");
    expect(cn("!fp-px-4", "!px-2")).toBe("!px-2");
    expect(cn("fp-bg-surface/85", "bg-black/50")).toBe("bg-black/50");
  });

  it("compares variants too", () => {
    expect(cn("fp-grid fp-grid-cols-2 sm:fp-grid-cols-4", "sm:grid-cols-2")).toBe(
      "fp-grid fp-grid-cols-2 sm:grid-cols-2",
    );
    expect(cn("hover:fp-bg-fill", "hover:bg-white")).toBe("hover:bg-white");
    expect(cn("sm:fp-px-4", "px-2")).toBe("sm:fp-px-4 px-2");
  });

  it("keeps the kit's own component classes and group markers", () => {
    const own =
      "fp-press fp-skeleton fp-row-enter fp-anim-pop fp-scroll-fade-x fp-bulkbar fp-group";
    expect(cn(own, "fp-px-2", "group")).toBe(`${own} fp-px-2 group`);
  });

  it("keeps a prefixed size with a line-height modifier apart from a colour", () => {
    expect(cn("fp-text-sm/6", "text-red-600")).toBe("fp-text-sm/6 text-red-600");
    expect(cn("fp-text-xs/5", "fp-text-ok-ink")).toBe("fp-text-xs/5 fp-text-ok-ink");
    expect(cn("hover:fp-text-sm/6", "hover:text-red-600")).toBe(
      "hover:fp-text-sm/6 hover:text-red-600",
    );
    expect(cn("fp-text-sm/6", "text-lg/7")).toBe("text-lg/7");
  });

  it("knows the kit's spring easing", () => {
    expect(cn("fp-ease-spring", "ease-linear")).toBe("ease-linear");
  });
});
