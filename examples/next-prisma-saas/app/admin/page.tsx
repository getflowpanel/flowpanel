"use client";
import { flowpanel } from "@/src/flowpanel";

export default function AdminPage() {
  return (
    <div className="fp">
      <p>FlowPanel Admin</p>
      <pre>{JSON.stringify(Object.keys(flowpanel.resources ?? {}), null, 2)}</pre>
    </div>
  );
}
