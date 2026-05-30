// Detect the user's platform so the install-help modal can show the
// right instructions. We rely on userAgent (good enough — wrong guess
// just shows slightly off instructions, never breaks anything).

export type InstallPlatform =
  | "ios-safari"      // iPhone/iPad — Share → Add to Home Screen
  | "android-chrome"  // Android — Chrome menu → Install app / Add to Home screen
  | "macos-safari"    // Safari 17+ on macOS — File → Add to Dock
  | "desktop-chromium" // Chrome / Edge / Brave / Opera on desktop
  | "firefox"         // No install support on desktop
  | "unsupported";    // Best-effort message

export const detectInstallPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent;

  // iOS (iPhone / iPad). Also covers iPad on iPadOS 13+ which spoofs as Mac
  // but always exposes maxTouchPoints > 1.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios-safari";

  if (/Android/i.test(ua)) return "android-chrome";

  if (/Firefox\//.test(ua)) return "firefox";

  // Safari desktop = "Safari" in UA but no "Chrome" / "Chromium".
  if (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium")) {
    return "macos-safari";
  }

  // Chromium family (Chrome / Edge / Brave / Opera / Vivaldi) on desktop.
  if (/Chrome\/|Chromium\/|Edg\//.test(ua)) return "desktop-chromium";

  return "unsupported";
};
