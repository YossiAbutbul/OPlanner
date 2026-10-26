import type { Transition } from "framer-motion";

// Shared springs, in Apple's terms: `bounce` stands in for damping ratio
// (0 = critically damped) and `visualDuration` for response. Tap-driven UI
// never overshoots; a little bounce is reserved for releases that carry
// momentum (flicking a sheet or drawer).

/** Menus, segmented thumbs, small popovers. */
export const SPRING_SNAPPY: Transition = { type: "spring", bounce: 0, visualDuration: 0.26 };

/** Dialogs, page-level content. */
export const SPRING_DEFAULT: Transition = { type: "spring", bounce: 0, visualDuration: 0.36 };

/** Sheets and drawers settling after a drag (damping ~0.8, response 0.3). */
export const SPRING_SHEET: Transition = { type: "spring", bounce: 0.14, visualDuration: 0.32 };

/**
 * Where a flick would come to rest (Apple's scroll-deceleration projection,
 * from the Designing Fluid Interfaces sample code). Velocity in px/s.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary instead of a hard stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
