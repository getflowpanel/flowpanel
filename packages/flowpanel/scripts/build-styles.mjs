import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const FLOWPANEL_SUBJECT =
  ":where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)";

const fpColor = (name) => `hsl(var(--fp-${name}) / <alpha-value>)`;

const STYLE_SOURCES = ["react", "next", "charts"];

const tailwindConfig = {
  content: STYLE_SOURCES.map((name) => resolve(REPOSITORY, `packages/${name}/dist/**/*.{js,mjs}`)),
  // Tailwind's base layer also initializes utility variables. Keep those
  // prerequisites, but disable Preflight before compilation so no host
  // element selector can enter the artifact.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        "fp-bg-1": fpColor("bg-1"),
        "fp-bg-2": fpColor("bg-2"),
        "fp-bg-3": fpColor("bg-3"),
        "fp-text-1": fpColor("text-1"),
        "fp-text-2": fpColor("text-2"),
        "fp-text-3": fpColor("text-3"),
        "fp-border-1": fpColor("border-1"),
        "fp-border-2": fpColor("border-2"),
        "fp-accent": fpColor("accent"),
        "fp-accent-text": fpColor("accent-text"),
        "fp-focus": fpColor("ring"),
        "fp-overlay": fpColor("overlay"),
        "fp-ok": fpColor("ok"),
        "fp-warn": fpColor("warn"),
        "fp-err": fpColor("err"),
        "fp-info": fpColor("info"),
        "fp-ok-text": fpColor("ok-text"),
        "fp-warn-text": fpColor("warn-text"),
        "fp-err-text": fpColor("err-text"),
        "fp-info-text": fpColor("info-text"),
        "fp-accent-badge-text": fpColor("accent-badge-text"),
        "fp-chart-1": fpColor("chart-1"),
        "fp-chart-2": fpColor("chart-2"),
        "fp-chart-3": fpColor("chart-3"),
        "fp-chart-4": fpColor("chart-4"),
        "fp-chart-5": fpColor("chart-5"),
        "fp-chart-6": fpColor("chart-6"),
        "fp-chart-7": fpColor("chart-7"),
      },
      borderRadius: {
        fp: "var(--fp-radius)",
        "fp-sm": "var(--fp-radius-sm)",
        "fp-lg": "var(--fp-radius-lg)",
        "fp-xl": "var(--fp-radius-xl)",
      },
      boxShadow: {
        "fp-xs": "var(--fp-shadow-xs)",
        "fp-sm": "var(--fp-shadow-sm)",
        "fp-md": "var(--fp-shadow-md)",
        "fp-lg": "var(--fp-shadow-lg)",
      },
      fontFamily: {
        sans: "var(--fp-font-sans)",
        mono: "var(--fp-font-mono)",
        "fp-sans": "var(--fp-font-sans)",
        "fp-mono": "var(--fp-font-mono)",
      },
      transitionTimingFunction: {
        "fp-out": "var(--fp-ease-out)",
        "fp-in-out": "var(--fp-ease-in-out)",
        "fp-spring": "var(--fp-ease-spring)",
      },
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

function namespaceLayers(root) {
  root.walkAtRules("layer", (rule) => {
    rule.params = rule.params.replace(
      /\b(?:theme|base|components|utilities)(?:\.flowpanel)?\b/g,
      (name) => (name === "base.flowpanel" ? "fp-base.flowpanel" : `fp-${name}`),
    );
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
  namespaceLayers(root);
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

export async function buildStyles() {
  await assertBuiltStyleSources();
  const input = await canonicalInput();
  const compiled = await postcss([tailwind(tailwindConfig)]).process(input, {
    from: CANONICAL_STYLESHEET,
  });
  const css = isolateCss(compiled.css);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, css);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildStyles();
}
