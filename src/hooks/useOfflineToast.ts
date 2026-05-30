import { useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";

// Watches the browser online/offline events and surfaces transitions via
// toasts. Mounts once at the app root.
//
// - Goes offline → info toast (Firestore queues writes locally, so the
//   user's edits aren't lost — we just tell them they may not sync yet).
// - Goes back online → success toast (queued writes start flushing).
//
// `wasOffline` guards against firing a "back online" toast on first mount
// when the user was never offline to begin with.
export function useOfflineToast(): void {
  const toast = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    const onOffline = () => {
      wasOffline.current = true;
      toast.info("You're offline. Changes will sync when reconnected.");
    };
    const onOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      toast.success("Back online — syncing your changes.");
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);
}
