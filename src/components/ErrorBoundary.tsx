import React from "react";
import "../css/NotFound.css";

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
// recovery page instead of a blank white screen, in the same style as the
// 404: warm paper and a calendar sheet for a day that didn't go to plan.
// The reset button drops the error and re-renders children — most useful
// for transient failures (network blip rendered into state). A full
// refresh button covers the rest.
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
      <div className="nf" role="alert">
        <div className="nf-bg" aria-hidden />

        <div className="nf-stage">
          <div className="nf-float">
            <div className="nf-pad" aria-hidden>
              <span className="nf-sheet nf-sheet-back" />
              <div className="nf-sheet nf-sheet-top">
                <div className="nf-sheet-rings">
                  <span />
                  <span />
                </div>
                <div className="nf-sheet-month">Oops</div>
                <div className="nf-sheet-day">!</div>
                <div className="nf-sheet-weekday">Unplanned</div>
              </div>
            </div>
          </div>
        </div>

        <div className="nf-copy">
          <span className="nf-code">Something went wrong</span>
          <h1>Well, this wasn't on the schedule</h1>
          <p>
            OPlanner hit an unexpected snag. Your courses, tasks and notes are saved, so nothing is
            lost. Try again, or reload the app.
          </p>
          <div className="nf-actions">
            <button type="button" onClick={this.reset} className="nf-btn">
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} className="nf-btn nf-btn-ghost">
              Reload app
            </button>
          </div>
          {error.message && (
            <code className="nf-path" title={error.message}>
              {error.message}
            </code>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
