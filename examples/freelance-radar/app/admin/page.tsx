import { flowpanel } from "@/src/flowpanel";

export default function AdminPage() {
  const resources = Object.keys(flowpanel.resources ?? {});
  return (
    <div className="fp p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">freelance-radar · admin</h1>
        <p className="text-sm text-muted-foreground">
          FlowPanel {resources.length}-resource demo — users, jobs, payments, AI costs.
        </p>
      </header>
      <section className="rounded-md border p-4">
        <p className="text-sm">Resources:</p>
        <ul className="mt-2 flex gap-2 text-sm">
          {resources.map((r) => (
            <li key={r} className="rounded-full border px-3 py-1">
              {r}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        Full UI wiring (FlowPanelUI) arrives with the B8 widgets milestone; this page already proves
        end-to-end compile + tRPC handler + typed adapter.
      </p>
    </div>
  );
}
