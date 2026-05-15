import { DefaultButton as Button } from "../ui/buttonDefault.js";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-base font-medium text-fp-text-1">{title}</div>
      {description ? <div className="mt-1 text-sm text-fp-text-3">{description}</div> : null}
      {action ? (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
