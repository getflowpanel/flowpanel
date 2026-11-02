"use client";
import { useLabels } from "../provider/LabelsContext";
import { DefaultButton as Button } from "../ui/button-default";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  const { errors } = useLabels();
  return (
    <div
      role="alert"
      className="fp-flex fp-flex-col fp-items-center fp-justify-center fp-py-16 fp-text-center"
    >
      <div className="fp-text-base fp-font-medium fp-text-ink">{title ?? errors.title}</div>
      {description ? <div className="fp-mt-1 fp-text-sm fp-text-faint">{description}</div> : null}
      {action ? (
        <Button className="fp-mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
