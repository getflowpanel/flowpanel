import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { DEFAULT_DOC_CONTRACTS } from "../docs/default-contracts";

describe("documented defaults", () => {
  it("match public JSDoc and an exact production consumer", () => {
    const root = join(import.meta.dirname, "../..");
    const project = new Project({
      tsConfigFilePath: join(root, "tsconfig.base.json"),
      skipAddingFilesFromTsConfig: true,
    });
    project.addSourceFilesAtPaths([
      join(root, "packages/core/src/types/**/*.ts"),
      join(root, "packages/react/src/**/*.ts"),
      join(root, "packages/react/src/**/*.tsx"),
    ]);

    for (const contract of DEFAULT_DOC_CONTRACTS) {
      const declaration = project
        .getSourceFiles()
        .flatMap((file) => file.getInterfaces())
        .find((item) => item.getName() === contract.typeName);
      const member = declaration?.getProperty(contract.member);
      const tag = member
        ?.getJsDocs()
        .flatMap((doc) => doc.getTags())
        .find((item) => item.getTagName() === "defaultValue");

      expect(tag?.getCommentText()?.trim(), `${contract.typeName}.${contract.member}`).toBe(
        contract.value,
      );
      expect(
        readFileSync(join(root, contract.consumerFile), "utf8"),
        `${contract.typeName}.${contract.member}`,
      ).toContain(contract.consumerExpression);
    }
  });

  it("uses shared constants for defaults consumed in three or more runtime paths", () => {
    const root = join(import.meta.dirname, "../..");
    const nextSource = [
      "packages/next/src/pages/resource-list.tsx",
      "packages/next/src/pages/resource-detail.tsx",
      "packages/next/src/controllers/resource-controller.ts",
      "packages/next/src/runtime/project-row.ts",
      "packages/next/src/drawer/drawer-route.ts",
    ]
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    const chartSource = ["AreaChart.tsx", "BarChart.tsx", "LineChart.tsx", "PieChart.tsx"]
      .map((file) => readFileSync(join(root, "packages/charts/src/runtime", file), "utf8"))
      .join("\n");

    expect(nextSource.match(/DEFAULT_RESOURCE_PAGE_SIZE/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(nextSource.match(/DEFAULT_RESOURCE_ROW_KEY/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(chartSource.match(/\?\? DEFAULT_CHART_HEIGHT/g)?.length ?? 0).toBe(4);
  });
});
