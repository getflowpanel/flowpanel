"use client";
import * as React from "react";

export interface JsonEditorProps<T = unknown> {
  value: T;
  onChange: (value: T) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
  id?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

export function JsonEditor<T = unknown>({
  value,
  onChange,
  rows = 8,
  className,
  placeholder,
  id,
  "aria-invalid": externalInvalid,
  "aria-describedby": describedBy,
  "aria-required": ariaRequired,
}: JsonEditorProps<T>) {
  const [text, setText] = React.useState(() => safeStringify(value));
  const [error, setError] = React.useState<string | null>(null);

  const lastEmitted = React.useRef<string>(text);
  React.useEffect(() => {
    const next = safeStringify(value);
    if (next !== lastEmitted.current) {
      setText(next);
      setError(null);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setText(next);
    try {
      const parsed = JSON.parse(next) as T;
      setError(null);
      lastEmitted.current = safeStringify(parsed);
      onChange(parsed);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
    }
  };

  return (
    <div className={className}>
      <textarea
        id={id}
        value={text}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder ?? "{}"}
        onChange={handleChange}
        aria-invalid={error !== null || externalInvalid === true}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        {...(ariaRequired ? { "aria-required": true as const } : {})}
        className="fp-w-full fp-rounded fp-border fp-border-line fp-bg-surface fp-p-3 fp-font-mono fp-text-xs fp-text-ink fp-shadow-xs fp-transition-colors hover:fp-border-line-strong focus:fp-border-focus focus:fp-outline-none focus:fp-ring-2 focus:fp-ring-focus/25 data-[invalid=true]:fp-border-err"
      />
      {error ? (
        <div className="fp-mt-1 fp-text-xs fp-text-err-ink" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}
