// Deterministic color picker so each course gets a stable, distinct color
// without persisting anything. The same course name always maps to the same
// color across reloads and devices, but neighboring courses look different.

const PALETTE = [
  "#1db954", // green
  "#3498db", // blue
  "#9b59b6", // purple
  "#e67e22", // orange
  "#e74c3c", // red
  "#f1c40f", // yellow
  "#1abc9c", // teal
  "#34495e", // slate
  "#e91e63", // pink
  "#2ecc71", // emerald
  "#f39c12", // amber
  "#16a085", // dark teal
];

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const defaultCourseColor = (name: string): string =>
  PALETTE[hash(name.toLowerCase()) % PALETTE.length];

export const courseColor = (
  name: string,
  explicitColor?: string | null
): string => explicitColor || defaultCourseColor(name);
