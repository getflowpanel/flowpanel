import { readCliReference } from "@/shared/lib/cli-reference";

interface CliReferenceProps {
  command?: string;
}

function CommandList() {
  const commands = readCliReference().slice(1);
  return (
    <div className="my-6 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Command</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {commands.map((command) => (
            <tr key={command.name}>
              <td>
                <code>{command.usage}</code>
              </td>
              <td>{command.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CliReference({ command }: CliReferenceProps) {
  if (command === undefined) return <CommandList />;

  const docs = readCliReference();
  const current = docs.find((entry) => entry.name === command);
  if (!current) {
    throw new Error(
      `Unknown FlowPanel CLI command "${command}". Valid commands: ${docs
        .slice(1)
        .map((entry) => entry.name)
        .join(", ")}.`,
    );
  }

  return (
    <div className="my-6 space-y-4">
      <pre>
        <code>{current.usage}</code>
      </pre>
      {current.arguments.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Argument</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {current.arguments.map((argument) => (
              <tr key={argument.syntax}>
                <td>
                  <code>{argument.syntax}</code>
                </td>
                <td>{argument.description || "—"}</td>
                <td>{argument.required ? "required" : "optional"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {current.options.map((option) => (
            <tr key={option.flags}>
              <td>
                <code>{option.flags}</code>
              </td>
              <td>{option.description}</td>
              <td>{option.defaultValue ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
