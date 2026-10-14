import { MediaFrame } from "@/shared/ui/media-frame";

const SHOTS = [
  {
    name: "admin-list",
    url: "localhost:3000/admin/customers",
    caption: "The customers list, with plan and status badges.",
    alt: "FlowPanel list of customers with company, contact, email, plan, status and joined columns, and the search box and filters above",
  },
  {
    name: "admin-record",
    url: "localhost:3000/admin/customers/3?tab=products",
    caption:
      "A customer's record page: counts that link to their rows, account facts and related tabs.",
    alt: "FlowPanel record page for one customer: status and plan badges, counts of monitors, products and open invoices and the amount paid, an account panel, and the products tab open with seven products, beside tabs for monitors, invoices and the record's history",
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
