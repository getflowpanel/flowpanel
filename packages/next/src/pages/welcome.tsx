import { EmptyState } from "@flowpanel/react";

const SNIPPET = `resource(schema.users, {
  label: "Users",
  columns: ["email", "name", "createdAt"],
}),`;

export function Welcome() {
  return (
    <EmptyState
      title="FlowPanel is mounted and working"
      description="Your resources array is empty. Add the first one in flowpanel.config.ts:"
      action={
        <div className="flex flex-col items-center gap-4">
          <pre className="max-w-lg overflow-x-auto rounded-fp border border-fp-border-1 bg-fp-bg-2 p-4 text-left font-mono text-xs text-fp-text-1">
            {SNIPPET}
          </pre>
          <p className="text-sm text-fp-text-3">See the FlowPanel docs to get started.</p>
        </div>
      }
    />
  );
}
