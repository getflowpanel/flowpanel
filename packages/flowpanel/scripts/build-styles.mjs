import { globSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { strayUtilities, unprefixedSelectors } from "./class-guard.mjs";

const require = createRequire(import.meta.url);
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");
const valueParser = require("postcss-value-parser");
const tailwind = require("tailwindcss3");

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = resolve(HERE, "..");
const REPOSITORY = resolve(PACKAGE, "../..");
const CANONICAL_STYLESHEET = resolve(REPOSITORY, "packages/react/src/styles/admin.css");
const OUTPUT = resolve(PACKAGE, "dist/styles/admin.css");
const BRIDGE_OUTPUT = resolve(PACKAGE, "dist/styles/tailwind.css");
const TONE_CLASSES = resolve(REPOSITORY, "packages/core/src/tone-classes.ts");

const FLOWPANEL_SUBJECT =
  ":where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)";

const STYLE_SOURCES = ["react", "next", "charts"];

export const KIT_PREFIX = "fp-";

// Bridge token name → the kit's own theme key, so kit classes read `fp-bg-surface`, not `fp-bg-fp-bg-1`.
export const KIT_THEME_KEYS = {
  color: {
    "fp-bg-1": "surface",
    "fp-bg-2": "canvas",
    "fp-bg-3": "fill",
    "fp-text-1": "ink",
    "fp-text-2": "soft",
    "fp-text-3": "faint",
    "fp-border-1": "line",
    "fp-border-2": "line-strong",
    "fp-accent": "accent",
    "fp-accent-text": "on-accent",
    "fp-focus": "focus",
    "fp-overlay": "overlay",
    "fp-ok": "ok",
    "fp-warn": "warn",
    "fp-err": "err",
    "fp-info": "info",
    "fp-ok-text": "ok-ink",
    "fp-warn-text": "warn-ink",
    "fp-err-text": "err-ink",
    "fp-info-text": "info-ink",
    "fp-accent-badge-text": "accent-ink",
    "fp-data": "data",
    "fp-chart-1": "chart-1",
    "fp-chart-2": "chart-2",
    "fp-chart-3": "chart-3",
    "fp-chart-4": "chart-4",
    "fp-chart-5": "chart-5",
    "fp-chart-6": "chart-6",
    "fp-chart-7": "chart-7",
  },
  radius: { fp: "DEFAULT", "fp-sm": "sm", "fp-lg": "lg", "fp-xl": "xl" },
  shadow: { "fp-xs": "xs", "fp-sm": "sm", "fp-md": "md", "fp-lg": "lg" },
  font: { "fp-sans": "sans", "fp-mono": "mono" },
  ease: { "fp-out": "out", "fp-in-out": "in-out", "fp-spring": "spring" },
};

export function kitTheme(css) {
  const theme = Object.fromEntries(Object.keys(KIT_THEME_KEYS).map((family) => [family, {}]));
  const seen = new Set();
  postcss.parse(css).walkAtRules("theme", (rule) => {
    rule.walkDecls((declaration) => {
      const [, family, name] =
        /^--(color|radius|shadow|font|ease)-(.+)$/.exec(declaration.prop) ?? [];
      const key = family && KIT_THEME_KEYS[family][name];
      if (!key) throw declaration.error(`${declaration.prop} has no kit name in KIT_THEME_KEYS`);
      seen.add(`${family}:${name}`);
      theme[family][key] =
        family === "color"
          ? declaration.value.replace(/\)$/, " / <alpha-value>)")
          : declaration.value;
    });
  });
  for (const [family, names] of Object.entries(KIT_THEME_KEYS)) {
    for (const name of Object.keys(names)) {
      if (!seen.has(`${family}:${name}`))
        throw new Error(`KIT_THEME_KEYS.${family} names ${name}, which @theme no longer defines`);
    }
  }
  return theme;
}

const theme = kitTheme(readFileSync(CANONICAL_STYLESHEET, "utf8"));

export const tailwindConfig = {
  prefix: KIT_PREFIX,
  content: [
    ...STYLE_SOURCES.map((name) => resolve(REPOSITORY, `packages/${name}/dist/**/*.{js,mjs}`)),
    TONE_CLASSES,
  ],
  // Tailwind's base layer also initializes utility variables. Keep those
  // prerequisites, but disable Preflight before compilation so no host
  // element selector can enter the artifact.
  corePlugins: { preflight: false },
  theme: {
    borderRadius: { none: "0px", ...theme.radius, full: "9999px" },
    boxShadow: { ...theme.shadow, none: "none" },
    extend: {
      colors: theme.color,
      fontFamily: theme.font,
      transitionTimingFunction: theme.ease,
    },
  },
};

function qualifierNode() {
  return selectorParser().astSync(FLOWPANEL_SUBJECT).nodes[0].nodes[0];
}

function isPseudoElement(node) {
  return (
    node.type === "pseudo" &&
    (node.value.startsWith("::") ||
      [":before", ":after", ":first-letter", ":first-line"].includes(node.value))
  );
}

function qualifySelector(selector) {
  const lastCombinator = [...selector.nodes]
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === "combinator")
    .at(-1);
  const rightmost = selector.nodes.slice((lastCombinator?.index ?? -1) + 1);
  const pseudoElement = rightmost.find(isPseudoElement);
  const qualifier = qualifierNode();
  if (pseudoElement) {
    // In a list such as `*, ::before`, selector-parser stores the formatting
    // space on the leading pseudo. Move it to the qualifier; otherwise the
    // inserted qualifier becomes an ancestor of the pseudo-element.
    if (pseudoElement === selector.nodes[0] && pseudoElement.spaces.before) {
      qualifier.spaces.before = pseudoElement.spaces.before;
      pseudoElement.spaces.before = "";
    }
    selector.insertBefore(pseudoElement, qualifier);
  } else selector.append(qualifier);
}

function isKeyframeStep(rule) {
  return rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name);
}

function scopeRules(root) {
  root.walkRules((rule) => {
    if (isKeyframeStep(rule)) return;
    try {
      rule.selector = selectorParser((selectors) => selectors.each(qualifySelector)).processSync(
        rule.selector,
      );
    } catch (error) {
      throw rule.error(
        `Could not safely scope selector ${JSON.stringify(rule.selector)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

function rejectGlobalSelectors(root) {
  root.walkRules((rule) => {
    if (isKeyframeStep(rule)) return;
    try {
      selectorParser((selectors) => {
        selectors.walkPseudos((pseudo) => {
          if (pseudo.value === ":root" || pseudo.value === ":host") {
            throw rule.error(
              `FlowPanel stylesheet contains an unsafe global selector: ${rule.selector}`,
            );
          }
        });
      }).processSync(rule.selector);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unsafe global selector")) throw error;
      throw rule.error(
        `Could not inspect selector ${JSON.stringify(rule.selector)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

function namespaceTailwindVariables(root) {
  root.walkDecls((declaration) => {
    declaration.prop = declaration.prop.replaceAll("--tw-", "--fp-tw-");
    declaration.value = declaration.value.replaceAll("--tw-", "--fp-tw-");
  });
  root.walkAtRules("property", (rule) => {
    rule.params = rule.params.replaceAll("--tw-", "--fp-tw-");
  });
}

function namespaceKeyframes(root) {
  const renamed = new Map();
  root.walkAtRules("keyframes", (rule) => {
    const name = rule.params.trim();
    if (!name || name.startsWith("fp-")) return;
    const next = `fp-tw-${name}`;
    renamed.set(name, next);
    rule.params = next;
  });
  if (!renamed.size) return;

  root.walkDecls(/^animation(?:-name)?$/, (declaration) => {
    const value = valueParser(declaration.value);
    value.walk((node) => {
      if (node.type === "word" && renamed.has(node.value)) node.value = renamed.get(node.value);
    });
    declaration.value = value.toString();
  });
}

function assertIsolated(root) {
  const css = root.toString();
  if (/--tw-/.test(css)) throw new Error("FlowPanel stylesheet leaked a --tw-* custom property");
  if (/@keyframes\s+(?!fp-)/.test(css))
    throw new Error("FlowPanel stylesheet leaked an unnamespaced keyframe");
  root.walkRules((rule) => {
    if (isKeyframeStep(rule)) return;
    if (!rule.selector.includes(FLOWPANEL_SUBJECT)) {
      throw rule.error(`FlowPanel stylesheet has an unscoped selector: ${rule.selector}`);
    }
  });
}

export function isolateCss(css) {
  const root = postcss.parse(css);
  rejectGlobalSelectors(root);
  namespaceTailwindVariables(root);
  namespaceKeyframes(root);
  scopeRules(root);
  assertIsolated(root);
  return root.toString();
}

async function canonicalInput() {
  const root = postcss.parse(await readFile(CANONICAL_STYLESHEET, "utf8"));
  root.walkAtRules("import", (rule) => rule.remove());
  root.walkAtRules("theme", (rule) => rule.remove());
  root.prepend({ name: "tailwind", params: "utilities" });
  root.prepend({ name: "tailwind", params: "components" });
  root.prepend({ name: "tailwind", params: "base" });
  return root.toString();
}

async function assertBuiltStyleSources() {
  for (const name of STYLE_SOURCES) {
    const directory = resolve(REPOSITORY, `packages/${name}/dist`);
    const result = await stat(directory).catch(() => null);
    if (!result?.isDirectory()) {
      throw new Error(
        `Cannot build the admin stylesheet: packages/${name}/dist is missing. Run the dependency builds first.`,
      );
    }
    if ((await readdir(directory)).length === 0) {
      throw new Error(
        `Cannot build the admin stylesheet: packages/${name}/dist is empty. Run the dependency builds first.`,
      );
    }
  }
}

export function tailwindBridge(css) {
  const blocks = [];
  postcss.parse(css).walkAtRules("theme", (rule) => {
    blocks.push(rule.toString());
  });
  if (blocks.length !== 1) {
    throw new Error(
      `Expected exactly one @theme block in ${CANONICAL_STYLESHEET}, found ${blocks.length}.`,
    );
  }
  return `${blocks[0]}\n`;
}

export function styleSourceFiles() {
  const files = STYLE_SOURCES.flatMap((name) =>
    globSync(`packages/${name}/dist/**/*.{js,mjs}`, { cwd: REPOSITORY }),
  );
  return [...files, relative(REPOSITORY, TONE_CLASSES)].map((file) => ({
    file,
    text: readFileSync(resolve(REPOSITORY, file), "utf8"),
  }));
}

async function assertPrefixed(css) {
  const selectors = unprefixedSelectors(css);
  if (selectors.length) {
    throw new Error(`FlowPanel stylesheet has unprefixed classes: ${selectors.join(", ")}`);
  }
  const strays = await strayUtilities(styleSourceFiles());
  if (strays.length) {
    const list = strays.map(({ file, candidate }) => `${candidate} (${file})`).join(", ");
    throw new Error(
      `Kit classes must start with "${KIT_PREFIX}", or the host's utilities restyle them: ${list}`,
    );
  }
}

export async function buildStyles() {
  await assertBuiltStyleSources();
  const input = await canonicalInput();
  const compiled = await postcss([tailwind(tailwindConfig)]).process(input, {
    from: CANONICAL_STYLESHEET,
  });
  const css = isolateCss(compiled.css);
  await assertPrefixed(css);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, css);
  await writeFile(BRIDGE_OUTPUT, tailwindBridge(await readFile(CANONICAL_STYLESHEET, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildStyles();
}
