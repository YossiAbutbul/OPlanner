import { useCallback, useEffect, useState } from "react";

// Wraps the Document Picture-in-Picture API (Chromium 116+). Opens a real
// always-on-top OS window, copies the page's styles into it, and exposes the
// PiP document body as a portal target. Falls back to unsupported elsewhere.

export const pipSupported = (): boolean =>
  typeof window !== "undefined" && "documentPictureInPicture" in window;

// Clone all <style> and <link rel="stylesheet"> from the opener into the PiP
// document so the portalled UI keeps its CSS (PiP has its own document).
const copyStyles = (target: Document) => {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    if (node.tagName === "LINK") {
      const link = node as HTMLLinkElement;
      const clone = target.createElement("link");
      clone.rel = "stylesheet";
      clone.type = link.type || "text/css";
      clone.media = link.media;
      clone.href = link.href;
      target.head.appendChild(clone);
    } else {
      target.head.appendChild(node.cloneNode(true));
    }
  });
};

interface UsePipResult {
  supported: boolean;
  pipWindow: Window | null;
  open: (opts?: { width?: number; height?: number }) => Promise<void>;
  close: () => void;
}

export function useDocumentPip(): UsePipResult {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // Support is static for the session; compute once.
  const [supported] = useState(pipSupported);

  const close = useCallback(() => {
    // Closing the window fires "pagehide" which clears state below.
    pipWindow?.close();
  }, [pipWindow]);

  const open = useCallback(
    async (opts?: { width?: number; height?: number }) => {
      if (!supported || pipWindow) return;
      const api = window.documentPictureInPicture!;
      const w = await api.requestWindow({
        width: opts?.width ?? 280,
        height: opts?.height ?? 400,
      });
      copyStyles(w.document);
      w.document.body.style.margin = "0";
      w.document.body.style.background = "transparent";
      // PiP card fills the window edge-to-edge.
      w.document.documentElement.classList.add("pip-root");
      setPipWindow(w);
      w.addEventListener("pagehide", () => setPipWindow(null), { once: true });
    },
    [pipWindow, supported]
  );

  // Close the PiP window if the component unmounts.
  useEffect(() => {
    return () => {
      pipWindow?.close();
    };
  }, [pipWindow]);

  return { supported, pipWindow, open, close };
}
