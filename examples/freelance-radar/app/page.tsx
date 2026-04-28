import Link from "next/link";

export default function Home() {
  return (
    <main className="p-10 space-y-4">
      <h1 className="text-3xl font-bold">freelance-radar</h1>
      <p className="text-muted-foreground">FlowPanel end-to-end demo.</p>
      <Link
        href="/admin"
        className="inline-block rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Open admin →
      </Link>
    </main>
  );
}
