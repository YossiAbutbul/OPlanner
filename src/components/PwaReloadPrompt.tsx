import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useUpdate } from "../context/UpdateContext";

// Signed in: a sticky toast, so the update never interrupts work. Tapping it
// is the only path that reliably reaches an installed mobile PWA, where the
// app is suspended (not closed) so a waiting build would otherwise never
// activate.
// Signed out: there's nothing to lose on the sign-in screen, so the new
// build is applied right away instead of asking. Not while a field has
// focus, so a reload can't eat what's being typed.
const PwaReloadPrompt = (): null => {
  const { user, loading } = useAuth();
  const { needRefresh, nextVersion, applyUpdate } = useUpdate();
  const { info, dismiss } = useToast();
  const signedIn = !!user;

  useEffect(() => {
    if (!needRefresh || !signedIn) return;
    const id = info("Update available", {
      description: nextVersion
        ? `Version ${nextVersion} is ready. Reload to get it.`
        : "A new version is ready. Reload to get it.",
      sticky: true,
      action: { label: "Update", onClick: applyUpdate },
    });
    return () => dismiss(id);
  }, [needRefresh, signedIn, nextVersion, applyUpdate, info, dismiss]);

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

  return null;
};

export default PwaReloadPrompt;
