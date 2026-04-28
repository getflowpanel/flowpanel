import { flowpanel } from "@/src/flowpanel";

export default function AdminPage() {
  const resourceKeys = Object.keys(flowpanel.resources ?? {});
  return (
    <div className="fp">
      <p>FlowPanel Admin</p>
      <pre>{JSON.stringify(resourceKeys, null, 2)}</pre>
    </div>
  );
}
