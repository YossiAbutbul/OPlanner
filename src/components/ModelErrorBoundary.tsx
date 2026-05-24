import React from "react";

interface State {
  failed: boolean;
}

/**
 * Catches GLTF load failures and renders the procedural fallback.
 */
export class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  State
> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("Model load failed, using procedural fallback:", error.message);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
