import type { ReactNode } from "react";

export interface FormSectionProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ label, description, children, className }: FormSectionProps) {
  return (
    <section className={`mb-6 space-y-3 ${className ?? ""}`}>
      <div>
        <div className="text-sm font-medium text-fp-text-1">{label}</div>
        {description ? <div className="text-xs text-fp-text-3">{description}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
