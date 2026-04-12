import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[FlowPanel] Component error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            borderLeft: "3px solid var(--fp-err)",
            background: "rgba(239,68,68,0.05)",
            borderRadius: "var(--fp-radius-sm)",
            padding: 16,
            margin: "12px 0",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fp-text-1)",
              marginBottom: 6,
            }}
          >
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--fp-text-3)",
              fontFamily: "var(--fp-font-mono)",
            }}
          >
            {this.state.error?.message ?? "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 10,
              padding: "5px 10px",
              fontSize: 12,
              background: "var(--fp-surface-3)",
              border: "1px solid var(--fp-border-2)",
              borderRadius: 6,
              color: "var(--fp-text-2)",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
