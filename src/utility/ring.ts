// stroke-dasharray for a progress ring drawn with pathLength=100 and round
// caps. Each cap adds half the stroke width past the arc's end, so a plain
// `pct 100` dash overshoots by a full stroke width: at 97% the ends touch
// and the ring looks closed. Shortening the dash by that amount makes the
// visible arc match the percentage (a tiny value still shows as a dot).
export function ringDash(pct: number, strokeWidth: number, radius: number): string {
  if (pct <= 0) return "0 100";
  if (pct >= 100) return "100 0";
  const capPct = (strokeWidth / (2 * Math.PI * radius)) * 100;
  return `${Math.max(0.01, pct - capPct)} 100`;
}
