import "@testing-library/jest-dom/vitest";

// Stub matchMedia — jsdom doesn't implement it. Sidebar.tsx reads it on
// mount to pick mobile vs desktop layout; without this, every test that
// touches Sidebar throws.
if (!window.matchMedia) {
  // @ts-expect-error — minimal shim is enough for tests
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
