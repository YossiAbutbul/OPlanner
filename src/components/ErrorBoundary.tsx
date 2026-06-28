import React from "react";
import AuroraBackground from "./AuroraBackground";

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
      <div className="eb-screen">
        <AuroraBackground />

        <div className="eb-card">
          <div className="eb-badge" aria-hidden="true">
            <span className="eb-badge-orbit" />
            <span className="eb-badge-ring" />
            <span className="eb-badge-ring eb-badge-ring-2" />
            <div className="eb-badge-core">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2.5" />
                <path d="M3 10h18M8 2v4M16 2v4" />
                <path d="m10 14.5 4 4M14 14.5l-4 4" />
              </svg>
            </div>
          </div>

          <h1 className="eb-title">Well, this wasn't on the schedule</h1>
          <p className="eb-text">
            OPlanner tripped over an unexpected snag. Your courses, tasks and notes
            are safely saved - let's get you back on track.
          </p>

          <div className="eb-actions">
            <button onClick={this.reset} className="eb-btn eb-btn-primary">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="eb-btn eb-btn-ghost">
              Reload app
            </button>
          </div>

          {error.message && (
            <p className="eb-error" title={error.message}>
              <span className="eb-error-dot" aria-hidden="true" />
              {error.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
