import { useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  // Touch must start within this many pixels of the screen edge to count
  // as an edge swipe. Wider = easier to trigger but more false positives
  // when scrolling lists.
  edgeWidth?: number;
  // Minimum horizontal travel before we commit to opening. Lower = twitchier.
  threshold?: number;
  // Maximum vertical drift relative to horizontal — past this ratio the
  // gesture is a vertical scroll, not a swipe.
  maxVerticalRatio?: number;
  onSwipeFromLeft?: () => void;
  onSwipeFromRight?: () => void;
}

// Detect swipe-from-screen-edge gestures on touch devices. Wires touchstart
// + touchend listeners on window and only fires when:
//   1. enabled is true (gated by caller on PWA + mobile)
//   2. the finger landed within edgeWidth of the left or right viewport edge
//   3. the horizontal travel exceeds threshold and dominates vertical travel
//
// Lives at the window level so a swipe across any in-app element (even ones
// with their own touch handlers) can still open the drawer — the listener
// is passive and never preventDefaults, so scrolling and drag-resize inside
// the app remain unaffected.
export function useEdgeSwipe({
  enabled,
  edgeWidth = 24,
  threshold = 60,
  maxVerticalRatio = 0.7,
  onSwipeFromLeft,
  onSwipeFromRight,
}: Options): void {
  // Refs hold the latest callbacks so we never re-bind the touch listeners.
  const onLeftRef = useRef(onSwipeFromLeft);
  const onRightRef = useRef(onSwipeFromRight);
  useEffect(() => {
    onLeftRef.current = onSwipeFromLeft;
    onRightRef.current = onSwipeFromRight;
  }, [onSwipeFromLeft, onSwipeFromRight]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startEdge: "left" | "right" | null = null;

    const onStart = (e: TouchEvent) => {
      // Multi-touch (pinch zoom etc) shouldn't open the drawer.
      if (e.touches.length !== 1) {
        startEdge = null;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      const w = window.innerWidth;
      if (startX <= edgeWidth) startEdge = "left";
      else if (startX >= w - edgeWidth) startEdge = "right";
      else startEdge = null;
    };

    const onEnd = (e: TouchEvent) => {
      if (!startEdge) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Vertical scroll, not a swipe.
      if (absDx === 0 || absDy / absDx > maxVerticalRatio) {
        startEdge = null;
        return;
      }
      // Must travel inward past threshold.
      if (absDx < threshold) {
        startEdge = null;
        return;
      }
      if (startEdge === "left" && dx > 0) onLeftRef.current?.();
      else if (startEdge === "right" && dx < 0) onRightRef.current?.();
      startEdge = null;
    };

    const onCancel = () => {
      startEdge = null;
    };

    // Passive listeners — we never preventDefault, so the page keeps
    // scrolling normally and any pointer-event-based drag (DayPanel
    // resize, etc.) is unaffected.
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled, edgeWidth, threshold, maxVerticalRatio]);
}
