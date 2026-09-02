import { resolve } from "node:path";
import { readCompatibility } from "@/shared/lib/compatibility";

const REPOSITORY_ROOT = resolve(process.cwd(), "../..");

export function Compatibility() {
  const items = readCompatibility(REPOSITORY_ROOT);
  return (
    <div className="my-6 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Supported range</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.requirement}</td>
              <td>
                <code>{item.range}</code>
              </td>
              <td>{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
