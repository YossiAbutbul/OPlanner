// True on touch / coarse-pointer devices (phones, tablets). Used to suppress
// auto-focusing inputs on open — otherwise the on-screen keyboard pops up the
// moment a modal/sheet appears, which is jarring on mobile.
export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
