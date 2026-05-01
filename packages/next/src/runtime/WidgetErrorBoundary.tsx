"use client";
import { ErrorCard } from "@flowpanel/react";
import * as React from "react";

interface State {
  error: Error | null;
}

export class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback ?? <ErrorCard error={this.state.error} />;
    }
    return this.props.children;
  }
}
