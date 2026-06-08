import { useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  // Current drawer state — required so close gestures only fire when the
  // matching drawer is open and so an open drawer doesn't accidentally
  // trigger an "open" gesture again.
  leftOpen?: boolean;
  rightOpen?: boolean;

  // Touch must start within this many pixels of the screen edge to count
  // as an edge swipe. Wider = easier to trigger but more false positives
  // when scrolling lists.
  edgeWidth?: number;
  // Minimum horizontal travel before we commit. Lower = twitchier.
  threshold?: number;
  // Maximum vertical drift relative to horizontal — past this ratio the
  // gesture is a vertical scroll, not a swipe.
  maxVerticalRatio?: number;

  // Open: swipe inward from the corresponding edge (only fires when the
  // matching drawer is currently closed).
  onOpenLeft?: () => void;
  onOpenRight?: () => void;
  // Close: swipe outward (left → close-left, right → close-right). Fires
  // when the matching drawer is currently open. Doesn't require an
  // edge-start, so the user can grab anywhere on the drawer and flick it
  // away — matches native drawer behavior.
  onCloseLeft?: () => void;
  onCloseRight?: () => void;
}

// Detect swipe gestures on touch devices to open / close the two app
// drawers. Wires passive touchstart + touchend listeners on window so the
// gesture can start over any in-app element without colliding with their
// own pointer handlers (DayPanel resize, etc.) — we never preventDefault.
export function useEdgeSwipe({
  enabled,
  leftOpen = false,
  rightOpen = false,
  edgeWidth = 24,
  threshold = 60,
  maxVerticalRatio = 0.7,
  onOpenLeft,
  onOpenRight,
  onCloseLeft,
  onCloseRight,
}: Options): void {
  // Refs hold the latest callbacks + state so the touch listeners never
  // need to be re-bound on every render.
  const cbRef = useRef({ onOpenLeft, onOpenRight, onCloseLeft, onCloseRight });
  const stateRef = useRef({ leftOpen, rightOpen });
  useEffect(() => {
    cbRef.current = { onOpenLeft, onOpenRight, onCloseLeft, onCloseRight };
  }, [onOpenLeft, onOpenRight, onCloseLeft, onCloseRight]);
  useEffect(() => {
    stateRef.current = { leftOpen, rightOpen };
  }, [leftOpen, rightOpen]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startedAtLeftEdge = false;
    let startedAtRightEdge = false;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      // Multi-touch (pinch zoom etc) shouldn't open the drawer.
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      const w = window.innerWidth;
      startedAtLeftEdge = startX <= edgeWidth;
      startedAtRightEdge = startX >= w - edgeWidth;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Vertical scroll, not a swipe.
      if (absDx === 0 || absDy / absDx > maxVerticalRatio) return;
      if (absDx < threshold) return;

      const { leftOpen: lOpen, rightOpen: rOpen } = stateRef.current;
      const { onOpenLeft: oL, onOpenRight: oR, onCloseLeft: cL, onCloseRight: cR } = cbRef.current;

      if (dx > 0) {
        // Rightward swipe.
        // Priority 1: if right drawer is open, push it away (close).
        if (rOpen) { cR?.(); return; }
        // Priority 2: started at left edge with left drawer closed → open it.
        if (!lOpen && startedAtLeftEdge) oL?.();
      } else {
        // Leftward swipe.
        if (lOpen) { cL?.(); return; }
        if (!rOpen && startedAtRightEdge) oR?.();
      }
    };

    const onCancel = () => {
      tracking = false;
    };

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
