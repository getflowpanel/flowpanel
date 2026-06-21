import Link from "next/link";

export default function Home() {
  return (
    <main id="main" className="p-10 space-y-4">
      <h1 className="text-3xl font-bold">ScrapeAI</h1>
      <p className="text-fp-text-3">
        Ops admin for an AI web-scraping SaaS — a FlowPanel end-to-end demo.
      </p>
      <Link
        href="/admin"
        className="inline-block rounded-fp border border-fp-border-1 px-4 py-2 text-sm font-medium hover:bg-fp-bg-2"
      >
        Open admin →
      </Link>
    </main>
  );
}
