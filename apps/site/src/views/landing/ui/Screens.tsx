import { MediaFrame } from "@/shared/ui/media-frame";

const SHOTS = [
  {
    name: "admin-list",
    url: "localhost:3000/admin/customers?f_plan=pro",
    caption: "The customers list, filtered to the Pro plan.",
    alt: "FlowPanel list of customers filtered to the Pro plan, with company, contact, email, plan and status columns and the filter bar above",
  },
  {
    name: "admin-record",
    url: "localhost:3000/admin/customers/1",
    caption:
      "A customer's record page: counts that link to their rows, account facts and related tabs.",
    alt: "FlowPanel record page for one customer: status and plan badges, counts of monitors, products and open invoices, an account panel and tabs for monitors, products and invoices",
  },
] as const;

export function Screens() {
  return (
    <section aria-label="A list and a record page" className="pb-16 md:pb-24">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-6 lg:grid-cols-2">
        {SHOTS.map((shot) => (
          <figure key={shot.name} className="min-w-0">
            <MediaFrame
              srcDark={`/${shot.name}-dark.png`}
              srcLight={`/${shot.name}-light.png`}
              alt={shot.alt}
              width={2200}
              height={1500}
              url={shot.url}
              sizes="(min-width: 1024px) 540px, 100vw"
            />
            <figcaption className="mt-3 text-sm text-[var(--color-fg-muted)]">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
