import React from "react";
import AuroraBackground from "./AuroraBackground";

// Shown when the URL path isn't the app root. The app has no client-side
// router, so any path other than the configured base (/, or /OPlanner/ on
// GitHub Pages) is a dead link rather than a real route.
const NotFound: React.FC = () => {
  const home = import.meta.env.BASE_URL || "/";

  return (
    <div className="eb-screen">
      <AuroraBackground />

      <div className="eb-card">
        <div className="eb-badge" aria-hidden="true">
          <span className="eb-badge-orbit" />
          <span className="eb-badge-ring" />
          <span className="eb-badge-ring eb-badge-ring-2" />
          <div className="eb-badge-core nf-badge-core">404</div>
        </div>

        <h1 className="eb-title">This page took a day off</h1>
        <p className="eb-text">
          We couldn't find anything here. Let's get you back to your planner.
        </p>

        <div className="eb-actions">
          <a href={home} className="eb-btn eb-btn-primary">
            Back to OPlanner
          </a>
        </div>

        <p className="eb-error" title={window.location.pathname}>
          <span className="eb-error-dot" aria-hidden="true" />
          {window.location.pathname}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
