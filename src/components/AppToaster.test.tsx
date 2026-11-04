import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { sileo } from "sileo";
import AppToaster from "./AppToaster";
import { ToastProvider, useToast } from "../context/ToastContext";

// Sileo's viewport is replaced by a marker, so a test can tell which of the
// two toast UIs AppToaster mounted.
vi.mock("sileo", () => {
  let n = 0;
  const make = () => `sileo-${++n}`;
  return {
    sileo: {
      success: vi.fn(make),
      error: vi.fn(make),
      info: vi.fn(make),
      dismiss: vi.fn(),
    },
    Toaster: () => <div data-testid="sileo-toaster" />,
  };
});

// Every environment the app runs in. The screen is what usePhoneToasts reads;
// the window and the installed-PWA flag are set too, to prove neither one
// changes the answer.
interface Env {
  name: string;
  // Device screen, in CSS pixels, as held when the test runs.
  screen: [number, number];
  // Browser window; can differ from the screen (a small desktop window).
  window: [number, number];
  standalone: boolean;
  ui: "sileo" | "plain";
}

const ENVS: Env[] = [
  { name: "desktop browser tab", screen: [1920, 1080], window: [1440, 900], standalone: false, ui: "sileo" },
  { name: "small desktop window", screen: [1920, 1080], window: [420, 380], standalone: false, ui: "sileo" },
  { name: "installed PWA on a desktop", screen: [1920, 1080], window: [1440, 900], standalone: true, ui: "sileo" },
  { name: "tablet browser tab", screen: [768, 1024], window: [768, 1024], standalone: false, ui: "sileo" },
  { name: "installed PWA on a tablet", screen: [768, 1024], window: [768, 1024], standalone: true, ui: "sileo" },
  { name: "phone browser tab", screen: [390, 844], window: [390, 664], standalone: false, ui: "plain" },
  { name: "phone browser tab in landscape", screen: [844, 390], window: [844, 300], standalone: false, ui: "plain" },
  { name: "installed PWA on a phone", screen: [390, 844], window: [390, 844], standalone: true, ui: "plain" },
  { name: "installed PWA on a phone in landscape", screen: [844, 390], window: [844, 390], standalone: true, ui: "plain" },
];

const setDim = (target: object, key: string, value: number | boolean | undefined) =>
  Object.defineProperty(target, key, { value, configurable: true });

const applyEnv = (env: Env) => {
  setDim(window.screen, "width", env.screen[0]);
  setDim(window.screen, "height", env.screen[1]);
  setDim(window, "innerWidth", env.window[0]);
  setDim(window, "innerHeight", env.window[1]);
  setDim(window.navigator, "standalone", env.standalone || undefined);
  window.matchMedia = ((query: string) => ({
    matches: query === "(display-mode: standalone)" ? env.standalone : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

// Fires toasts from inside the provider, driven by clicks so nothing is
// assigned to module scope during render.
const TRANSIENT = "fire transient";
const PROMPT = "fire prompt";
const Pusher: React.FC = () => {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Task updated", { description: "Due tomorrow" })}>
        {TRANSIENT}
      </button>
      <button
        onClick={() =>
          toast.info("Update available", {
            description: "Version 9.9.9 is ready. Reload to get it.",
            sticky: true,
            action: { label: "Update", onClick: () => {} },
          })
        }
      >
        {PROMPT}
      </button>
    </>
  );
};

const mount = () =>
  render(
    <ToastProvider>
      <AppToaster />
      <Pusher />
    </ToastProvider>
  );

// The plain list portals into document.body, so it is queried there.
const plainToasts = () => document.body.querySelectorAll(".toast");

describe("which toast UI each environment gets", () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  for (const env of ENVS) {
    it(`${env.name} mounts the ${env.ui} UI`, () => {
      applyEnv(env);
      mount();

      if (env.ui === "sileo") {
        expect(screen.getByTestId("sileo-toaster")).toBeInTheDocument();
        expect(document.body.querySelector(".toast-stack")).toBeNull();
      } else {
        expect(screen.queryByTestId("sileo-toaster")).toBeNull();
        expect(document.body.querySelector(".toast-stack")).not.toBeNull();
      }
    });

    it(`${env.name} ${env.ui === "sileo" ? "shows" : "drops"} a transient toast`, () => {
      applyEnv(env);
      mount();

      fireEvent.click(screen.getByText(TRANSIENT));

      if (env.ui === "sileo") {
        expect(sileo.success).toHaveBeenCalledWith(expect.objectContaining({ title: "Task updated" }));
      } else {
        expect(sileo.success).not.toHaveBeenCalled();
        expect(plainToasts()).toHaveLength(0);
      }
    });

    it(`${env.name} shows the update prompt`, () => {
      applyEnv(env);
      mount();

      fireEvent.click(screen.getByText(PROMPT));

      if (env.ui === "sileo") {
        expect(sileo.info).toHaveBeenCalledWith(expect.objectContaining({ title: "Update available" }));
      } else {
        expect(sileo.info).not.toHaveBeenCalled();
        expect(plainToasts()).toHaveLength(1);
        expect(screen.getByText("Update available")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
      }
    });
  }
});
