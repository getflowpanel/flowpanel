import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");
const ts = require("typescript");
const resolveTailwindConfig = require("tailwindcss3/resolveConfig");
const { createContext } = require("tailwindcss3/lib/lib/setupContextUtils");
const { generateRules } = require("tailwindcss3/lib/lib/generateRules");
const { defaultExtractor } = require("tailwindcss3/lib/lib/defaultExtractor");
const tailwind4 = require("tailwindcss");

const KIT_PREFIX = "fp-";

// Plain words the kit's JS uses as values or prose, which Tailwind would also accept as a class.
const NON_CLASS_WORDS = new Set([
  "!filter",
  "!hidden",
  "block",
  "filter",
  "fixed",
  "grid",
  "hidden",
  "inline",
  "outline",
  "relative",
  "resize",
  "ring",
  "static",
  "table",
  "transition-colors",
  "visible",
]);

const CLASS_FUNCTION = /^(?:cn|clsx|cx|cva|twMerge|twJoin)\d*$/;
const CLASS_NAME = /class/i;

async function tailwind4Vocabulary() {
  const root = dirname(require.resolve("tailwindcss/package.json"));
  const system = await tailwind4.__unstable__loadDesignSystem('@import "tailwindcss";', {
    base: root,
    async loadStylesheet(id, base) {
      const path = id === "tailwindcss" ? resolve(root, "index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  return (candidate) => system.candidatesToCss([candidate])[0] !== null;
}

/** Whether a default Tailwind 3 or 4 build, as a host runs it, generates a rule for the candidate. */
async function hostVocabulary() {
  const context = createContext(
    resolveTailwindConfig({ content: [{ raw: "" }], corePlugins: { preflight: false } }),
    [],
    postcss.root(),
  );
  const isTailwind4 = await tailwind4Vocabulary();
  const isUtility = (candidate) =>
    generateRules(new Set([candidate]), context).length > 0 || isTailwind4(candidate);
  return { extract: defaultExtractor(context), isUtility };
}

function calleeName(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return "";
}

function propertyName(node) {
  return node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ? node.name.text
    : "";
}

function partialEdges(index, count, text) {
  return { start: index > 0 && !/^\s/.test(text), end: index < count - 1 && !/\s$/.test(text) };
}

/** The text of every string the kit's code uses as a class list, with tokens cut by `${…}` dropped. */
export function classStrings(text, fileName = "module.js") {
  const kind = fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const collect = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const pieces = [node.head, ...node.templateSpans.map((span) => span.literal)];
      pieces.forEach((piece, index) => {
        const edges = partialEdges(index, pieces.length, piece.text);
        const tokens = piece.text.split(/\s+/);
        if (edges.start) tokens.shift();
        if (edges.end) tokens.pop();
        found.push(tokens.join(" "));
      });
      for (const span of node.templateSpans) collect(span.expression);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return collect(node.right);
      if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.PlusToken
      ) {
        collect(node.left);
        return collect(node.right);
      }
      return;
    }
    if (ts.isConditionalExpression(node)) {
      collect(node.whenTrue);
      return collect(node.whenFalse);
    }
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node);
      if (name === "defaultVariants") return;
      if (ts.isStringLiteral(node.name) && isClassObjectOf(node.parent)) found.push(node.name.text);
      return collect(node.initializer);
    }
    if (ts.isCallExpression(node)) {
      if (CLASS_FUNCTION.test(calleeName(node))) node.arguments.forEach(collect);
      return;
    }
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) return;
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return collect(node.body);
    if (ts.isBlock(node) || ts.isReturnStatement(node) || ts.isIfStatement(node)) {
      return ts.forEachChild(node, (child) =>
        ts.isIfStatement(node) && child === node.expression ? undefined : collect(child),
      );
    }
    if (ts.isArrayLiteralExpression(node) && isCompoundVariants(node)) {
      for (const element of node.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        for (const property of element.properties) {
          if (ts.isPropertyAssignment(property) && CLASS_NAME.test(propertyName(property))) {
            collect(property.initializer);
          }
        }
      }
      return;
    }
    if (
      ts.isArrayLiteralExpression(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isSpreadElement(node)
    ) {
      ts.forEachChild(node, collect);
    }
  };
  const isClassObjectOf = (object) =>
    ts.isObjectLiteralExpression(object) &&
    ts.isCallExpression(object.parent) &&
    CLASS_FUNCTION.test(calleeName(object.parent)) &&
    !calleeName(object.parent).startsWith("cva");
  const isCompoundVariants = (array) =>
    ts.isPropertyAssignment(array.parent) && propertyName(array.parent) === "compoundVariants";
  const visit = (node) => {
    if (ts.isCallExpression(node) && CLASS_FUNCTION.test(calleeName(node))) {
      node.arguments.forEach(collect);
    } else if (ts.isPropertyAssignment(node) && CLASS_NAME.test(propertyName(node))) {
      collect(node.initializer);
    } else if (ts.isJsxAttribute(node) && CLASS_NAME.test(node.name.getText(source))) {
      if (node.initializer) collect(node.initializer);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      CLASS_NAME.test(node.name.text) &&
      node.initializer
    ) {
      collect(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Class tokens in kit code that a host's Tailwind would style instead of the kit stylesheet. */
export async function strayUtilities(sources) {
  const { extract, isUtility } = await hostVocabulary();
  const strays = [];
  const seen = new Set();
  const report = (file, candidate) => {
    const key = `${file}\0${candidate}`;
    if (seen.has(key)) return;
    seen.add(key);
    strays.push({ file, candidate });
  };
  for (const { file, text } of sources) {
    for (const value of classStrings(text, file)) {
      for (const candidate of value.split(/\s+/)) {
        if (candidate && isUtility(candidate)) report(file, candidate);
      }
    }
    for (const candidate of new Set(extract(text))) {
      if (!NON_CLASS_WORDS.has(candidate) && isUtility(candidate)) report(file, candidate);
    }
  }
  return strays;
}

function utilityOf(className) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < className.length; index++) {
    const char = className[index];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    else if (char === ":" && depth === 0) start = index + 1;
  }
  return className.slice(start).replace(/^!?-?/, "");
}

/** Class selectors in a compiled stylesheet that do not carry the kit prefix. */
export function unprefixedSelectors(css) {
  const found = new Set();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    selectorParser((selectors) => {
      selectors.walkClasses((node) => {
        if (!utilityOf(node.value).startsWith(KIT_PREFIX)) found.add(node.value);
      });
    }).processSync(rule.selector);
  });
  return [...found];
}
