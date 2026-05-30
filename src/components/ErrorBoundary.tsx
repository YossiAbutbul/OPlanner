import React from "react";

interface Props {
  children: React.ReactNode;
  // Optional custom fallback render fn — receives the caught error and a reset
  // callback. If omitted, the default recovery UI is shown.
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

// Top-level safety net. A React render error anywhere in the tree shows a
// recovery card instead of a blank white screen. The reset button drops the
// error and re-renders children — most useful for transient failures
// (network blip rendered into state). A full refresh button covers the rest.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface in dev tools; can later forward to Sentry / similar.
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="error-boundary">
        <h1>Something went wrong</h1>
        <p className="error-boundary-msg">{error.message || "Unknown error"}</p>
        <div className="error-boundary-actions">
          <button onClick={this.reset} className="error-boundary-btn">
            Try again
          </button>
          <button onClick={() => window.location.reload()} className="error-boundary-btn">
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
