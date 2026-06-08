import confetti from "canvas-confetti";

// Small celebration burst — used when a task transitions to COMPLETED.
// Two side cannons from the bottom corners so the particles flow up and
// across the viewport, plus a single center burst for a focal point.
// Skipped entirely when the user prefers reduced motion.
export const celebrateTaskDone = (): void => {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Brand-aligned palette: green accent + complementary purples / blues
  // so the burst doesn't read as monochrome.
  const colors = ["#1db954", "#1ed760", "#3498db", "#9b59b6", "#f1c40f"];

  // Center burst.
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 40,
    origin: { x: 0.5, y: 0.7 },
    colors,
    zIndex: 9999,
    disableForReducedMotion: true,
  });

  // Side cannons — a short overlapping pair feels richer than one big burst.
  const sideCannon = (originX: number, angle: number) => {
    confetti({
      particleCount: 40,
      angle,
      spread: 55,
      startVelocity: 45,
      origin: { x: originX, y: 0.85 },
      colors,
      zIndex: 9999,
      disableForReducedMotion: true,
    });
  };
  setTimeout(() => sideCannon(0.1, 60), 80);
  setTimeout(() => sideCannon(0.9, 120), 160);
};
