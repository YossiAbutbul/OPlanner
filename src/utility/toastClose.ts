import { sileo } from "sileo";

// Sileo has no close control, and each toast is a single <button>, so one
// can't be rendered inside it through React. This adds a small round "x"
// to every sileo toast as it appears (macOS notification style: top-left
// corner of the card, shown on hover, always on touch) and dismisses it
// through sileo's own API.

const CLOSE_CLASS = "sileo-close";
const X_SVG =
  '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

// The toast's id, read from the props React gave the Sileo component that
// rendered it (the host <button>'s nearest ancestor fiber with an id and an
// onDismiss). Null if sileo's internals ever stop matching.
const toastIdOf = (el: Element): string | null => {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  type Fiber = { return: Fiber | null; memoizedProps?: { id?: unknown; onDismiss?: unknown } };
  let fiber = key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
  for (let i = 0; fiber && i < 6; i++, fiber = fiber.return) {
    const p = fiber.memoizedProps;
    if (p && typeof p.id === "string" && typeof p.onDismiss === "function") return p.id;
  }
  return null;
};

const attach = (toast: Element) => {
  if (toast.querySelector(`:scope > .${CLOSE_CLASS}`)) return;
  const id = toastIdOf(toast);
  if (!id) return;
  const x = document.createElement("span");
  x.className = CLOSE_CLASS;
  x.setAttribute("role", "button");
  x.setAttribute("tabindex", "0");
  x.setAttribute("aria-label", "Dismiss notification");
  x.innerHTML = X_SVG;
  // Stop here: the toast underneath would read a press as the start of a
  // swipe or as a tap that expands it.
  const stop = (e: Event) => e.stopPropagation();
  x.addEventListener("pointerdown", stop);
  x.addEventListener("mousedown", stop);
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    sileo.dismiss(id);
  });
  x.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.stopPropagation();
    e.preventDefault();
    sileo.dismiss(id);
  });
  toast.appendChild(x);
};

// Watches for sileo toasts and gives each a close button. Returns the
// cleanup.
export const installToastClose = (): (() => void) => {
  const SEL = "[data-sileo-toast]";
  document.querySelectorAll(SEL).forEach(attach);
  // Only look at what was just added, so the rest of the app's DOM churn
  // costs next to nothing.
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches(SEL)) attach(n);
        else n.querySelectorAll(SEL).forEach(attach);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};
