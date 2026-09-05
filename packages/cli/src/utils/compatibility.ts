import semver from "semver";
import { type DependencyInspection, inspectDependency } from "./project-packages";

export interface CompatibilityFinding {
  name: string;
  ok: boolean;
  required: string;
  observed: string;
  recovery: string;
  dependency: DependencyInspection;
}

export type SelectedOrm = "drizzle" | "prisma" | null;

export interface ProjectCompatibility {
  findings: CompatibilityFinding[];
  /** The adapter init may generate for; declaration wins over reachable transitive packages. */
  orm: SelectedOrm;
  ormFinding: CompatibilityFinding | null;
}

function observed(dependency: DependencyInspection): string {
  if (dependency.installed) return dependency.installed.version;
  if (dependency.error === "invalid-manifest") return "invalid installed manifest";
  if (dependency.error === "pnp-only") return "Yarn PnP-only layout";
  return dependency.declaration
    ? `not installed (declared ${dependency.declaration.specifier})`
    : "not installed";
}

function versionFinding(
  dependency: DependencyInspection,
  required: string,
  recovery: string,
): CompatibilityFinding {
  const version = dependency.installed?.version;
  const ok =
    !!version &&
    semver.valid(version) !== null &&
    !semver.prerelease(version) &&
    semver.satisfies(version, required);
  return {
    name: dependency.name,
    ok,
    required,
    observed: observed(dependency),
    recovery,
    dependency,
  };
}

export async function inspectProjectCompatibility(cwd: string): Promise<ProjectCompatibility> {
  const [next, react, reactDom, drizzle, prisma, typescript] = await Promise.all([
    inspectDependency(cwd, "next"),
    inspectDependency(cwd, "react"),
    inspectDependency(cwd, "react-dom"),
    inspectDependency(cwd, "drizzle-orm"),
    inspectDependency(cwd, "@prisma/client"),
    inspectDependency(cwd, "typescript"),
  ]);
  const drizzleFinding = versionFinding(
    drizzle,
    ">=0.45.2 <1.0.0",
    "Install a supported drizzle-orm version.",
  );
  const prismaFinding = versionFinding(
    prisma,
    ">=5.0.0 <7.0.0",
    "Install a supported @prisma/client version.",
  );
  const orm: SelectedOrm = drizzle.declaration
    ? "drizzle"
    : prisma.declaration
      ? "prisma"
      : drizzle.installed && !prisma.installed
        ? "drizzle"
        : prisma.installed && !drizzle.installed
          ? "prisma"
          : null;
  const ormFinding = orm === "drizzle" ? drizzleFinding : orm === "prisma" ? prismaFinding : null;
  const findings = [
    versionFinding(
      next,
      ">=16.3.0 <17.0.0",
      "Install a supported Next.js version, then reinstall the project.",
    ),
    versionFinding(react, ">=19.0.0 <20.0.0", "Install React 19 with the project package manager."),
    versionFinding(
      reactDom,
      ">=19.0.0 <20.0.0",
      "Install react-dom 19 with the project package manager.",
    ),
  ];
  findings.push({
    name: "React and React DOM versions match",
    ok:
      !!react.installed &&
      !!reactDom.installed &&
      react.installed.version === reactDom.installed.version,
    required: "React and react-dom must have the exact same installed version",
    observed: `react ${observed(react)}; react-dom ${observed(reactDom)}`,
    recovery: "Align the installed react and react-dom versions with the project package manager.",
    dependency: react,
  });
  findings.push(drizzleFinding, prismaFinding);
  findings.push({
    name: "typescript",
    ok: typescript.installed !== null,
    required: "installed TypeScript",
    observed: observed(typescript),
    recovery: "Install TypeScript in this project before running init.",
    dependency: typescript,
  });
  const nodeRange = next.installed?.manifest.engines?.node;
  if (nodeRange) {
    findings.push({
      name: "Node.js",
      ok:
        semver.satisfies(process.versions.node, ">=20.0.0") &&
        semver.satisfies(process.versions.node, nodeRange),
      required: `Node >=20 and Next.js requires ${nodeRange}`,
      observed: process.versions.node,
      recovery: "Use a Node version supported by both FlowPanel and the installed Next.js package.",
      dependency: next,
    });
  } else {
    findings.push({
      name: "Node.js",
      ok: semver.satisfies(process.versions.node, ">=20.0.0"),
      required: "Node >=20",
      observed: process.versions.node,
      recovery: "Use Node 20 or newer.",
      dependency: next,
    });
  }
  return { findings, orm, ormFinding };
}

export async function evaluateProjectCompatibility(cwd: string): Promise<CompatibilityFinding[]> {
  return (await inspectProjectCompatibility(cwd)).findings;
}

const PNP_UNSUPPORTED =
  "This project uses Yarn's PnP-only layout. FlowPanel reads installed packages from node_modules and never executes .pnp.cjs, so it cannot see what is installed here. Run `yarn config set nodeLinker node-modules` and reinstall, then run this command again.";

export function firstCompatibilityFailure(findings: CompatibilityFinding[]): string | null {
  const finding = findings.find((item) => !item.ok);
  if (!finding) return null;
  if (finding.dependency.error === "pnp-only") return PNP_UNSUPPORTED;
  return `${finding.name} is unsupported. Found ${finding.observed}. Required ${finding.required}. ${finding.recovery}`;
}
