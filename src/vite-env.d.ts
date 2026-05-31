/// <reference types="vite/client" />

// vite-plugin-pwa exposes `virtual:pwa-register/react` at build time. Its
// shipped types live at a subpath (`vite-plugin-pwa/react`) that a
// `/// <reference types>` directive doesn't reliably resolve under
// moduleResolution: bundler, so declare the slice we use directly.
declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
