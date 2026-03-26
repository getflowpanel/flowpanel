import kleur from "kleur";

export interface ActionableError {
  problem: string;
  likelyCause?: string;
  toFix?: string;
  command?: string;
  docsUrl?: string;
}

export function formatError(err: ActionableError): string {
  const lines: string[] = [
    "",
    kleur.red("  ✗ " + err.problem),
    "",
    kleur.gray("  " + "─".repeat(51)),
  ];

  if (err.likelyCause) {
    lines.push("  " + kleur.yellow("Likely cause"));
    lines.push("    " + err.likelyCause);
    lines.push("");
  }

  if (err.toFix) {
    lines.push("  " + kleur.cyan("To fix"));
    lines.push("    " + err.toFix);
    if (err.command) {
      lines.push("    ┌" + "─".repeat(err.command.length + 4) + "┐");
      lines.push("    │  " + err.command + "  │");
      lines.push("    └" + "─".repeat(err.command.length + 4) + "┘");
    }
    lines.push("");
  }

  if (err.docsUrl) {
    lines.push("  " + kleur.gray("More  " + err.docsUrl));
  }

  lines.push("  " + kleur.gray("─".repeat(51)));
  lines.push("");
  return lines.join("\n");
}

export function formatSuccess(msg: string): string {
  return `  ${kleur.green("✓")} ${msg}`;
}

export function formatWarning(msg: string): string {
  return `  ${kleur.yellow("⚠")} ${msg}`;
}

export function formatStep(msg: string): string {
  return `  ${kleur.cyan("›")} ${msg}`;
}
