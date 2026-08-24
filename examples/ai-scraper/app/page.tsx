import Link from "next/link";

const SOURCE = "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper";
const STEPS = [
  "Monitor marketplaces",
  "Match offers to products",
  "Review uncertain results",
] as const;

export default function Home() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-16 sm:px-6"
    >
      <div className="w-full border-y border-fp-border-1 py-12 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fp-text-3">
          Canonical Flowpanel demo
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Competitive price intelligence, operated from one typed config.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-fp-text-2 sm:text-lg">
          ScrapeAI monitors marketplaces for its customers. It matches discovered offers to each
          customer’s product catalog with AI. Operators review uncertain results and keep every
          crawl, price, and decision traceable.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-fp bg-fp-accent px-4 py-2 text-sm font-semibold text-fp-accent-text hover:bg-fp-accent/90"
          >
            Open admin
          </Link>
          <a
            href={SOURCE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center px-1 py-2 text-sm font-semibold text-fp-text-2 underline decoration-fp-border-2 underline-offset-4 hover:text-fp-text-1"
          >
            View source
          </a>
        </div>

        <ol
          aria-label="How ScrapeAI works"
          className="mt-14 grid border-t border-fp-border-1 text-sm sm:grid-cols-3"
        >
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex min-h-16 items-center gap-3 border-b border-fp-border-1 py-4 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0"
            >
              <span className="text-xs tabular-nums text-fp-text-3">0{index + 1}</span>
              <span className="font-medium text-fp-text-1">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
