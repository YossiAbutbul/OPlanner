import { useEffect, useRef } from "react";
import { project, rubberband } from "../utility/motion";

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
  // Movement (px) before the gesture commits to a direction (hysteresis).
  slop?: number;
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

type Side = "left" | "right";

const DRAWER_SELECTOR: Record<Side, string> = { left: ".sidebar", right: ".rs" };

// Drawer swipes with direct manipulation: once the finger commits to a
// horizontal drag, the drawer tracks it 1:1 (rubber-banding past fully open).
// On release we project the flick forward (Apple's deceleration projection)
// and settle open or closed from where it would have come to rest, so a
// short fast flick works as well as a long slow drag. The settle itself is
// the drawer's CSS transition, which starts from the dragged position.
// Listeners are passive and never preventDefault, so they don't fight the
// app's own pointer handlers (DayPanel resize, etc.).
export function useEdgeSwipe({
  enabled,
  leftOpen = false,
  rightOpen = false,
  edgeWidth = 24,
  slop = 10,
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
    let side: Side | null = null;
    let opening = false;
    let tracking = false;
    let committed = false;
    let el: HTMLElement | null = null;
    let width = 0;
    let x = 0;
    let samples: { x: number; t: number }[] = [];

    // Drawer offset for a finger delta: 0 = fully open, ±width = closed.
    const offsetFor = (dx: number) => {
      if (side === "left") {
        const raw = opening ? -width + dx : dx;
        return raw > 0 ? rubberband(raw, width) : Math.max(raw, -width);
      }
      const raw = opening ? width + dx : dx;
      return raw < 0 ? -rubberband(-raw, width) : Math.min(raw, width);
    };

    const release = () => {
      if (!el) return;
      // Hand back to the CSS transition, which animates from here.
      el.classList.remove("drawer-dragging");
      el.style.transform = "";
      el = null;
    };

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
      const { leftOpen: lOpen, rightOpen: rOpen } = stateRef.current;
      if (lOpen) { side = "left"; opening = false; }
      else if (rOpen) { side = "right"; opening = false; }
      else if (startX <= edgeWidth) { side = "left"; opening = true; }
      else if (startX >= w - edgeWidth) { side = "right"; opening = true; }
      else side = null;
      tracking = side !== null;
      committed = false;
      samples = [{ x: startX, t: e.timeStamp }];
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || !side) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!committed) {
        if (Math.abs(dx) < slop && Math.abs(dy) < slop) return;
        // Vertical scroll, or a drag in the direction that can't do anything.
        const wrongWay = side === "left" ? (opening ? dx < 0 : dx > 0) : (opening ? dx > 0 : dx < 0);
        if (Math.abs(dy) / Math.abs(dx || 1) > maxVerticalRatio || wrongWay) {
          tracking = false;
          return;
        }
        el = document.querySelector<HTMLElement>(DRAWER_SELECTOR[side]);
        if (!el) {
          tracking = false;
          return;
        }
        width = el.offsetWidth;
        el.classList.add("drawer-dragging");
        committed = true;
      }
      x = offsetFor(dx);
      el!.style.transform = `translateX(${x}px)`;
      samples.push({ x: t.clientX, t: e.timeStamp });
      if (samples.length > 6) samples.shift();
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (!committed || !side) return;
      const last = e.changedTouches[0];
      samples.push({ x: last.clientX, t: e.timeStamp });
      // Velocity over the last few samples (px/s), not just the final move.
      const first = samples[0];
      const end = samples[samples.length - 1];
      const dt = Math.max(1, end.t - first.t);
      const velocity = ((end.x - first.x) / dt) * 1000;
      const resting = x + project(velocity);
      const open = side === "left" ? resting > -width / 2 : resting < width / 2;
      const s = side;
      release();
      const { onOpenLeft: oL, onOpenRight: oR, onCloseLeft: cL, onCloseRight: cR } = cbRef.current;
      if (open && opening) (s === "left" ? oL : oR)?.();
      if (!open && !opening) (s === "left" ? cL : cR)?.();
    };

    const onCancel = () => {
      tracking = false;
      release();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      release();
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled, edgeWidth, slop, maxVerticalRatio]);
}
