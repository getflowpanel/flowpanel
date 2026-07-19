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
        className="w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 p-3 font-mono text-xs text-fp-text-1 shadow-fp-xs transition-colors hover:border-fp-border-2 focus:border-fp-focus focus:outline-none focus:ring-2 focus:ring-fp-focus/25 data-[invalid=true]:border-fp-err"
      />
      {error ? (
        <div className="mt-1 text-xs text-fp-err-text" role="alert">
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
