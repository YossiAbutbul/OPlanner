import { useEffect, type ReactElement } from "react";
import { useAuth } from "../context/AuthContext";
import { useUpdate } from "../context/UpdateContext";
import "../css/PwaReloadPrompt.css";

// Signed in: a small banner, so the update never interrupts work. Tapping it
// is the only path that reliably reaches an installed mobile PWA, where the
// app is suspended (not closed) so a waiting build would otherwise never
// activate.
// Signed out: there's nothing to lose on the sign-in screen, so the new
// build is applied right away instead of asking. Not while a field has
// focus, so a reload can't eat what's being typed.
const PwaReloadPrompt = (): ReactElement | null => {
  const { user, loading } = useAuth();
  const { needRefresh, nextVersion, applyUpdate } = useUpdate();

  useEffect(() => {
    if (!needRefresh || loading || user) return;
    const typing = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    if (!typing()) {
      applyUpdate();
      return;
    }
    // Apply once the field is left. Checked a tick later: during focusout
    // focus hasn't reached the next field yet.
    const onBlur = () =>
      setTimeout(() => {
        if (!typing()) applyUpdate();
      });
    document.addEventListener("focusout", onBlur);
    return () => document.removeEventListener("focusout", onBlur);
  }, [needRefresh, loading, user, applyUpdate]);

  if (!needRefresh || !user) return null;

  return (
    <div className="pwa-update" role="status" aria-live="polite">
      <span className="pwa-update-text">
        {nextVersion ? `Version ${nextVersion} is available.` : "A new version is available."}
      </span>
      <button type="button" className="pwa-update-btn" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
};

export default PwaReloadPrompt;
