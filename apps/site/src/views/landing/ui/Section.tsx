import type { ReactNode } from "react";

interface SectionProps {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, lead, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto grid max-w-[1120px] gap-x-16 gap-y-10 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h2
            id={`${id}-title`}
            className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
          >
            {title}
          </h2>
          {lead ? (
            <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-[var(--color-fg-muted)]">
              {lead}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 lg:pt-2">{children}</div>
      </div>
    </section>
  );
}
