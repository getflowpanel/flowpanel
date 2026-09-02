import type { createProgram } from "../../packages/cli/src/program";

type Program = ReturnType<typeof createProgram>;
type CliArgument = Program["registeredArguments"][number];
type CliOption = Program["options"][number];

export interface CliArgumentDoc {
  syntax: string;
  description: string;
  required: boolean;
  variadic: boolean;
  defaultValue?: string;
}

export interface CliOptionDoc {
  flags: string;
  description: string;
  value: "none" | "required" | "optional";
  mandatory: boolean;
  negated: boolean;
  defaultValue?: string;
}

export interface CliCommandDoc {
  name: string;
  usage: string;
  description: string;
  arguments: readonly CliArgumentDoc[];
  options: readonly CliOptionDoc[];
}

function displayValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function readArgument(argument: CliArgument): CliArgumentDoc {
  const name = `${argument.name()}${argument.variadic ? "..." : ""}`;
  const defaultValue = displayValue(argument.defaultValue);
  return {
    syntax: argument.required ? `<${name}>` : `[${name}]`,
    description: argument.description,
    required: argument.required,
    variadic: argument.variadic,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
}

function readOption(option: CliOption): CliOptionDoc {
  const defaultValue = displayValue(option.defaultValue);
  return {
    flags: option.flags,
    description: option.description,
    value: option.required ? "required" : option.optional ? "optional" : "none",
    mandatory: option.mandatory,
    negated: option.negate,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
}

function readCommand(command: Program): CliCommandDoc {
  return {
    name: command.name(),
    usage:
      command
        .helpInformation()
        .split("\n", 1)[0]
        ?.replace(/^Usage:\s*/, "") ?? command.name(),
    description: command.description(),
    arguments: command.registeredArguments.map(readArgument),
    options: command.options.filter((option) => !option.hidden).map(readOption),
  };
}

export function buildCliReference(program: Program): CliCommandDoc[] {
  return [readCommand(program), ...program.commands.map(readCommand)];
}
