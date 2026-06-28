// Shared dark-themed backdrop: drifting green aurora blobs over a faint
// graph-paper grid. Sits behind content (absolute, inset 0, non-interactive).
// Used by the landing page and the ErrorBoundary fallback.
const AuroraBackground = () => (
  <div className="aurora-bg" aria-hidden="true">
    <div className="aurora-blob aurora-blob-1" />
    <div className="aurora-blob aurora-blob-2" />
    <div className="aurora-blob aurora-blob-3" />
    <div className="aurora-grid" />
  </div>
);

export default AuroraBackground;
