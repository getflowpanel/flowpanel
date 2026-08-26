import type { DocsProblem, PublicSymbol } from "./types";

export type ExclusionCategory = "internal-plumbing" | "type-only-reexport" | "upstream-primitive";

export interface ApiOwnershipRule {
  sourcePrefix: string;
  page: `/docs/${string}`;
  anchor?: string;
  guidance: boolean;
}

export interface ApiExclusionRule {
  sourcePrefix: string;
  category: ExclusionCategory;
  reason: string;
  packageName?: string;
  exportName?: string;
}

export type ApiOwnership =
  | {
      status: "documented";
      page: `/docs/${string}`;
      anchor?: string;
      guidance: boolean;
    }
  | {
      status: "excluded";
      category: ExclusionCategory;
      reason: string;
    };

export const API_OWNERSHIP_RULES = [
  {
    sourcePrefix: "packages/adapter-bullmq/src/adapter.ts",
    page: "/docs/reference/adapters",
    guidance: true,
  },
  {
    sourcePrefix: "packages/adapter-bullmq/src/board.ts",
    page: "/docs/reference/queues",
    guidance: true,
  },
  {
    sourcePrefix: "packages/adapter-drizzle/src/",
    page: "/docs/reference/adapters",
    guidance: true,
  },
  {
    sourcePrefix: "packages/adapter-prisma/src/",
    page: "/docs/reference/adapters",
    guidance: true,
  },
  {
    sourcePrefix: "packages/charts/src/builders/",
    page: "/docs/reference/widgets",
    anchor: "charts",
    guidance: true,
  },
  {
    sourcePrefix: "packages/charts/src/runtime/",
    page: "/docs/reference/react-components",
    anchor: "charts",
    guidance: true,
  },
  { sourcePrefix: "packages/client/src/", page: "/docs/reference/client", guidance: true },
  {
    sourcePrefix: "packages/core/src/auth/",
    page: "/docs/reference/define-config",
    anchor: "authentication",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/builders/dashboard.ts",
    page: "/docs/reference/define-config",
    anchor: "dashboards",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/builders/queue.ts",
    page: "/docs/reference/queues",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/builders/resource.ts",
    page: "/docs/reference/resources",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/builders/widget.ts",
    page: "/docs/reference/widgets",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/compiler/",
    page: "/docs/reference/runtime-contracts",
    anchor: "compiler-runtime-contract",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/define-admin.ts",
    page: "/docs/reference/define-config",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/format-column.ts",
    page: "/docs/reference/resources",
    anchor: "column-formatting",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/humanize.ts",
    page: "/docs/reference/define-config",
    anchor: "labels",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/policy/",
    page: "/docs/reference/resources",
    anchor: "access-control",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/resource-name.ts",
    page: "/docs/reference/registry",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/runtime/",
    page: "/docs/reference/runtime-contracts",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/action.ts",
    page: "/docs/reference/actions",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/adapter-scope.ts",
    page: "/docs/reference/runtime-contracts",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/bound-scope.ts",
    page: "/docs/reference/adapters",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/adapter.ts",
    page: "/docs/reference/adapters",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/command.ts",
    page: "/docs/reference/define-config",
    anchor: "command-palette",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/types/config.ts",
    page: "/docs/reference/define-config",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/context.ts",
    page: "/docs/reference/contexts",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/dashboard.ts",
    page: "/docs/reference/widgets",
    anchor: "dashboard-layout",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/drawer.ts",
    page: "/docs/reference/drawer",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/error.ts",
    page: "/docs/reference/errors",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/icon.ts",
    page: "/docs/reference/define-config",
    anchor: "icons",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/types/labels.ts",
    page: "/docs/reference/define-config",
    anchor: "labels",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/types/paths.ts",
    page: "/docs/reference/define-config",
    anchor: "paths",
    guidance: false,
  },
  {
    sourcePrefix: "packages/core/src/types/policy.ts",
    page: "/docs/reference/resources",
    anchor: "access-control",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/queue.ts",
    page: "/docs/reference/queues",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/realtime.ts",
    page: "/docs/reference/scope-realtime",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/registry.ts",
    page: "/docs/reference/registry",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/resource.ts",
    page: "/docs/reference/resources",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/result.ts",
    page: "/docs/reference/errors",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/session.ts",
    page: "/docs/reference/contexts",
    anchor: "session-and-scope",
    guidance: true,
  },
  {
    sourcePrefix: "packages/core/src/types/widget.ts",
    page: "/docs/reference/widgets",
    guidance: true,
  },
  {
    sourcePrefix: "packages/eslint-plugin/src/",
    page: "/docs/reference/eslint-plugin",
    guidance: true,
  },
  { sourcePrefix: "packages/next/src/actions/", page: "/docs/reference/actions", guidance: true },
  {
    sourcePrefix: "packages/next/src/command/",
    page: "/docs/reference/react-components",
    anchor: "command-palette",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/controllers/",
    page: "/docs/reference/next-runtime",
    anchor: "controllers",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/create-flowpanel.tsx",
    page: "/docs/reference/next-runtime",
    guidance: true,
  },
  { sourcePrefix: "packages/next/src/drawer/", page: "/docs/reference/drawer", guidance: true },
  {
    sourcePrefix: "packages/next/src/flowpanel-page.tsx",
    page: "/docs/reference/next-runtime",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/handlers.ts",
    page: "/docs/reference/next-runtime",
    anchor: "route-handlers",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/pages/",
    page: "/docs/reference/react-components",
    anchor: "next-components",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/runtime/",
    page: "/docs/reference/next-runtime",
    anchor: "runtime-helpers",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/stream.ts",
    page: "/docs/reference/scope-realtime",
    anchor: "streaming",
    guidance: true,
  },
  {
    sourcePrefix: "packages/next/src/wire/",
    page: "/docs/reference/next-runtime",
    anchor: "wire-format",
    guidance: false,
  },
  {
    sourcePrefix: "packages/react/src/_atoms/",
    page: "/docs/reference/react-components",
    anchor: "atoms",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_data/",
    page: "/docs/reference/react-components",
    anchor: "data-display",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_feedback/",
    page: "/docs/reference/react-components",
    anchor: "feedback",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_forms/",
    page: "/docs/reference/react-components",
    anchor: "forms",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_layout/",
    page: "/docs/reference/react-components",
    anchor: "layout",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_provider/",
    page: "/docs/reference/react-components",
    anchor: "providers",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_shell/",
    page: "/docs/reference/react-components",
    anchor: "shell",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/_widgets/",
    page: "/docs/reference/react-components",
    anchor: "widgets",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/devtools/",
    page: "/docs/reference/react-components",
    anchor: "devtools",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/hooks/",
    page: "/docs/reference/react-components",
    anchor: "hooks",
    guidance: true,
  },
  {
    sourcePrefix: "packages/react/src/lib/",
    page: "/docs/reference/react-components",
    anchor: "utilities",
    guidance: false,
  },
  {
    sourcePrefix: "packages/react/src/realtime/",
    page: "/docs/reference/react-components",
    anchor: "realtime",
    guidance: true,
  },
] as const satisfies readonly ApiOwnershipRule[];

export const API_EXCLUSIONS = [
  {
    sourcePrefix: "packages/react/src/ui/",
    category: "upstream-primitive",
    reason:
      "These thin shadcn and Radix wrappers keep the upstream component contract; duplicating that reference would drift and mislead readers.",
  },
  {
    sourcePrefix: "node_modules/",
    category: "upstream-primitive",
    reason:
      "This symbol is re-exported from an upstream dependency, so its authoritative API contract belongs to that dependency.",
  },
] as const satisfies readonly ApiExclusionRule[];

function matchesRule(symbol: PublicSymbol, rule: ApiOwnershipRule): boolean {
  return symbol.declarationPath.startsWith(rule.sourcePrefix);
}

function matchesExclusion(symbol: PublicSymbol, rule: ApiExclusionRule): boolean {
  return (
    symbol.declarationPath.startsWith(rule.sourcePrefix) &&
    (rule.packageName === undefined || rule.packageName === symbol.packageName) &&
    (rule.exportName === undefined || rule.exportName === symbol.exportName)
  );
}

export function resolveApiOwnership(
  symbol: PublicSymbol,
  rules: readonly ApiOwnershipRule[] = API_OWNERSHIP_RULES,
  exclusions: readonly ApiExclusionRule[] = API_EXCLUSIONS,
): ApiOwnership | null {
  const exclusion = exclusions.find((rule) => matchesExclusion(symbol, rule));
  if (exclusion) {
    return {
      status: "excluded",
      category: exclusion.category,
      reason: exclusion.reason,
    };
  }

  const matches = rules.filter((rule) => matchesRule(symbol, rule));
  if (matches.length !== 1) return null;
  const [rule] = matches;
  return {
    status: "documented",
    page: rule.page,
    ...(rule.anchor ? { anchor: rule.anchor } : {}),
    guidance: rule.guidance,
  };
}

export function checkApiOwnership(
  symbols: readonly PublicSymbol[],
  pages: ReadonlySet<string>,
  rules: readonly ApiOwnershipRule[] = API_OWNERSHIP_RULES,
  exclusions: readonly ApiExclusionRule[] = API_EXCLUSIONS,
): DocsProblem[] {
  const problems: DocsProblem[] = [];
  const usedRules = new Set<ApiOwnershipRule>();

  for (const symbol of symbols) {
    const matchedExclusions = exclusions.filter((rule) => matchesExclusion(symbol, rule));
    if (matchedExclusions.length > 0) continue;

    const matchedRules = rules.filter((rule) => matchesRule(symbol, rule));
    for (const rule of matchedRules) usedRules.add(rule);

    if (matchedRules.length === 0) {
      problems.push({
        code: "api-unowned",
        file: symbol.declarationPath,
        line: 1,
        message: `${symbol.packageName}${symbol.exportPath === "." ? "" : symbol.exportPath.slice(1)} export ${symbol.exportName} has no canonical documentation owner.`,
        suggestion: "Add a narrow source-prefix ownership rule or a justified exclusion.",
      });
      continue;
    }

    if (matchedRules.length > 1) {
      problems.push({
        code: "api-rule-overlap",
        file: symbol.declarationPath,
        line: 1,
        message: `${symbol.exportName} matches ${matchedRules.length} API ownership rules.`,
        suggestion: "Make source prefixes disjoint so every declaration has exactly one owner.",
      });
      continue;
    }

    const [rule] = matchedRules;
    if (!pages.has(rule.page)) {
      problems.push({
        code: "api-page-missing",
        file: symbol.declarationPath,
        line: 1,
        message: `${symbol.exportName} points to missing canonical page ${rule.page}.`,
        suggestion: "Restore the page or update the ownership rule and its redirect together.",
      });
    }
  }

  for (const rule of rules) {
    if (usedRules.has(rule)) continue;
    problems.push({
      code: "api-rule-unused",
      file: "scripts/docs/api-ownership.ts",
      line: 1,
      message: `API ownership rule ${rule.sourcePrefix} matches no public declaration.`,
      suggestion: "Remove the stale rule or update it to the declaration's current source path.",
    });
  }

  return problems;
}
