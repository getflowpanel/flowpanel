import { describe, expect, it } from "vitest";
import {
  type ApiExclusionRule,
  type ApiOwnershipRule,
  checkApiOwnership,
  resolveApiOwnership,
} from "../docs/api-ownership";
import type { PublicSymbol } from "../docs/types";

function symbol(overrides: Partial<PublicSymbol> = {}): PublicSymbol {
  return {
    packageName: "@flowpanel/core",
    exportPath: ".",
    exportName: "ResourceConfig",
    kind: "interface",
    declarationPath: "packages/core/src/types/resource.ts",
    declarationName: "ResourceConfig",
    isTypeOnly: true,
    ...overrides,
  };
}

const rules = [
  {
    sourcePrefix: "packages/core/src/types/resource.ts",
    page: "/docs/reference/resources",
    guidance: false,
  },
  {
    sourcePrefix: "packages/react/src/_forms/",
    page: "/docs/reference/react-components",
    anchor: "forms",
    guidance: true,
  },
] satisfies readonly ApiOwnershipRule[];

const exclusions = [
  {
    sourcePrefix: "packages/react/src/ui/",
    category: "upstream-primitive",
    reason: "This is a thin Radix primitive re-export whose contract is owned upstream.",
  },
] satisfies readonly ApiExclusionRule[];

describe("API documentation ownership", () => {
  it("maps resource types and React form components by declaration source", () => {
    expect(resolveApiOwnership(symbol(), rules, exclusions)).toEqual({
      status: "documented",
      page: "/docs/reference/resources",
      guidance: false,
    });
    expect(
      resolveApiOwnership(
        symbol({
          packageName: "@flowpanel/react",
          exportName: "AutoForm",
          declarationName: "AutoForm",
          declarationPath: "packages/react/src/_forms/AutoForm.tsx",
          kind: "function",
          isTypeOnly: false,
        }),
        rules,
        exclusions,
      ),
    ).toEqual({
      status: "documented",
      page: "/docs/reference/react-components",
      anchor: "forms",
      guidance: true,
    });
  });

  it("uses the declaration source for aliased exports", () => {
    expect(
      resolveApiOwnership(
        symbol({ exportName: "PublicResource", declarationName: "ResourceConfig" }),
        rules,
        exclusions,
      ),
    ).toMatchObject({ status: "documented", page: "/docs/reference/resources" });
  });

  it("records justified upstream primitive exclusions", () => {
    expect(
      resolveApiOwnership(
        symbol({
          packageName: "@flowpanel/react",
          exportName: "DialogContent",
          declarationName: "DialogContent",
          declarationPath: "packages/react/src/ui/dialog.tsx",
        }),
        rules,
        exclusions,
      ),
    ).toEqual({
      status: "excluded",
      category: "upstream-primitive",
      reason: "This is a thin Radix primitive re-export whose contract is owned upstream.",
    });
  });

  it("reports an unmatched source directory", () => {
    const problems = checkApiOwnership(
      [symbol({ declarationPath: "packages/core/src/new-surface/index.ts" })],
      new Set(["/docs/reference/resources", "/docs/reference/react-components"]),
      rules,
      exclusions,
    );

    expect(problems).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "api-unowned" })]),
    );
  });

  it("reports unused and overlapping source rules", () => {
    const overlapping = [
      ...rules,
      {
        sourcePrefix: "packages/core/src/types/",
        page: "/docs/reference/runtime-contracts",
        guidance: false,
      },
      {
        sourcePrefix: "packages/never/src/",
        page: "/docs/reference/runtime-contracts",
        guidance: false,
      },
    ] satisfies readonly ApiOwnershipRule[];

    const problems = checkApiOwnership(
      [symbol()],
      new Set([
        "/docs/reference/resources",
        "/docs/reference/react-components",
        "/docs/reference/runtime-contracts",
      ]),
      overlapping,
      [],
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "api-rule-overlap" }),
        expect.objectContaining({ code: "api-rule-unused" }),
      ]),
    );
  });
});
