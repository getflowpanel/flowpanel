import { noOrmMessage } from "../commands/init-output";
import type { CompatibilityFinding, ProjectCompatibility } from "../utils/compatibility";
import type { PmCommands } from "../utils/detect";
import type { Check } from "./check";

interface StackCheck {
  finding: string;
  name: (finding: CompatibilityFinding | undefined) => string;
  hint: (finding: CompatibilityFinding | undefined, pmc: PmCommands) => string | undefined;
}

const STACK: ReadonlyArray<StackCheck> = [
  {
    finding: "next",
    name: (next) => {
      const version = next?.dependency.installed?.version;
      return version ? `Next.js ${version} (15.5 or 16)` : "Next.js 15.5 or 16";
    },
    hint: (next, pmc) =>
      next?.dependency.declaration === null
        ? `Next.js is not in package.json. Install: ${pmc.addDisplay("next@^16 react@^19 react-dom@^19", false)}`
        : `Found ${next?.observed}. Required ${next?.required}. ${next?.recovery}`,
  },
  { finding: "react", name: () => "React 19 installed", hint: (f) => f?.recovery },
  { finding: "react-dom", name: () => "React DOM 19 installed", hint: (f) => f?.recovery },
  {
    finding: "React and React DOM versions match",
    name: () => "React and React DOM versions match",
    hint: (f) => f?.recovery,
  },
  { finding: "Node.js", name: () => "Node.js supported", hint: (f) => f?.recovery },
  {
    finding: "typescript",
    name: () => "TypeScript installed",
    hint: (_, pmc) => `Install: ${pmc.addDisplay("typescript", true)}`,
  },
];

const ORM_NAMES = { drizzle: "Drizzle", prisma: "Prisma" } as const;

function check(name: string, ok: boolean, hint: string | undefined): Check {
  return hint === undefined ? { name, ok } : { name, ok, hint };
}

/** Next.js, React, Node, TypeScript and the ORM, in the order doctor prints them. */
export function stackChecks(report: ProjectCompatibility, pmc: PmCommands): Check[] {
  const checks = STACK.map(({ finding, name, hint }) => {
    const found = report.findings.find((candidate) => candidate.name === finding);
    return check(name(found), found?.ok ?? false, hint(found, pmc));
  });
  const orm = report.orm === null ? null : ORM_NAMES[report.orm];
  const ormFinding = report.ormFinding;
  checks.push(
    check(
      orm === null ? "ORM adapter (Drizzle or Prisma)" : `ORM adapter (${orm})`,
      ormFinding?.ok ?? false,
      orm === null
        ? noOrmMessage(pmc)
        : `Found ${ormFinding?.observed}. Required ${ormFinding?.required}. ${ormFinding?.recovery}`,
    ),
  );
  return checks;
}
