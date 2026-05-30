import "@testing-library/jest-dom/vitest";

// Stub matchMedia — jsdom doesn't implement it. Sidebar.tsx reads it on
// mount to pick mobile vs desktop layout; without this, every test that
// touches Sidebar throws.
if (!window.matchMedia) {
  // Minimal shim is enough for tests — cast covers the shape gap.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
