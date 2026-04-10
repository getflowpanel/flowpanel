import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FlowPanel] Caught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: 16,
            background: "var(--fp-surface-1)",
            border: "1px solid var(--fp-err)",
            borderRadius: "var(--fp-radius-lg)",
            color: "var(--fp-text-2)",
            fontSize: 13,
          }}
        >
          <div style={{ color: "var(--fp-err)", marginBottom: 8, fontWeight: 600 }}>
            Something went wrong
          </div>
          <div style={{ fontFamily: "var(--fp-font-mono)", fontSize: 11, marginBottom: 12 }}>
            {this.state.error?.message}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "4px 10px",
              background: "var(--fp-surface-3)",
              border: "1px solid var(--fp-border-2)",
              borderRadius: "var(--fp-radius-sm)",
              color: "var(--fp-text-1)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
