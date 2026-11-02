import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface FormSectionProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ label, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("fp-mb-6 fp-space-y-3", className)}>
      <div>
        <div className="fp-text-sm fp-font-medium fp-text-ink">{label}</div>
        {description ? <div className="fp-text-xs fp-text-faint">{description}</div> : null}
      </div>
      <div className="fp-space-y-3">{children}</div>
    </section>
  );
}
