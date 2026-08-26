import { readThemeSlots } from "@/shared/lib/theme-slots";

export function ThemeSlots() {
  const slots = readThemeSlots();
  return (
    <div className="my-6 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Component contract</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.name}>
              <td>
                <code>{slot.name}</code>
              </td>
              <td>
                <code>{slot.type}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
