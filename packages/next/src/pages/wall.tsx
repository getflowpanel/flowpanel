import type { ReactNode } from "react";

export interface WallProps {
  title: string;
  description?: string;
  /** The ways out: a link back, a retry, a sign-in. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A page the admin can't show, in place of it: what happened as the page's heading, then the ways out. */
export function Wall({ title, description, actions, children }: WallProps) {
  return (
    <section
      data-fp-error=""
      className="fp-mx-auto fp-flex fp-max-w-lg fp-flex-col fp-items-center fp-px-4 fp-py-16 fp-text-center sm:fp-py-24"
    >
      <h1 className="fp-text-xl fp-font-semibold fp-tracking-tight fp-text-ink">{title}</h1>
      {description ? (
        <p className="fp-mt-2 fp-text-sm fp-leading-relaxed fp-text-soft">{description}</p>
      ) : null}
      {children ? <div className="fp-mt-5">{children}</div> : null}
      {actions ? (
        <div className="fp-mt-6 fp-flex fp-flex-wrap fp-items-center fp-justify-center fp-gap-2">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
