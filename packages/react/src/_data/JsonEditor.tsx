"use client";
import * as React from "react";

export interface JsonEditorProps<T = unknown> {
  value: T;
  onChange: (value: T) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}

export function JsonEditor<T = unknown>({
  value,
  onChange,
  rows = 8,
  className,
  placeholder,
}: JsonEditorProps<T>) {
  const [text, setText] = React.useState(() => safeStringify(value));
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when the value prop changes externally (but not after our own edits).
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
        value={text}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder ?? "{}"}
        onChange={handleChange}
        aria-invalid={error !== null}
        className="w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 p-3 font-mono text-xs text-fp-text-1 focus:outline-none focus:ring-2 focus:ring-fp-accent data-[invalid=true]:border-red-500"
      />
      {error ? (
        <div className="mt-1 text-xs text-red-600" role="alert">
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
