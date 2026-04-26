"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onReload?: () => void;
};

type State = {
  hasError: boolean;
};

export class PosWorkspaceErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("pos.workspace_error", { message: error.message, componentStack: errorInfo.componentStack });
  }

  handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="boot-screen error">
          <section className="login-card">
            <h1>Workspace unavailable</h1>
            <p>The POS workspace hit an unexpected error. Reload to continue.</p>
            <button type="button" onClick={this.handleReload}>Reload workspace</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
