import React, { useEffect, useState } from "react";
import { Joyride, STATUS, EventData, Step } from "react-joyride";

const desktopSteps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to OPlanner",
    content:
      "30-second tour. We'll point at the buttons you'll actually use — click them as you go.",
  },
  {
    target: "[data-tour='import']",
    placement: "bottom",
    title: "Import calendar",
    content: "Drop your university .ics file. Courses + tasks fill in.",
    hideOverlay: true,
  },
  {
    target: "[data-tour='add-course']",
    placement: "bottom",
    title: "Add a course",
    content: "Or add courses manually here.",
    hideOverlay: true,
  },
  {
    target: "[data-tour='course-menu']",
    placement: "right",
    title: "Color a course",
    content: (
      <span>
        Tap the <span className="tour-kbd">⋮</span> next to a course to edit (rename, color) or delete it.
      </span>
    ),
    hideOverlay: true,
  },
  {
    target: "[data-tour='finals']",
    placement: "left",
    title: "Set finals",
    content: "Pick a date here — countdown starts.",
    hideOverlay: true,
  },
  {
    target: "[data-tour='settings']",
    placement: "right",
    title: "All set",
    content: "Add more years or replay this tour from the gear menu.",
    hideOverlay: true,
  },
];

const mobileSteps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to OPlanner",
    content: "Quick tour — tap Next to walk through the basics.",
  },
  {
    target: "[data-tour='import']",
    placement: "bottom",
    title: "Import calendar",
    content: "Drop your university .ics file to fill courses + tasks.",
    hideOverlay: true,
  },
  {
    target: "[data-tour='add-course']",
    placement: "bottom",
    title: "Add a course",
    content: "Or add courses manually here.",
    hideOverlay: true,
  },
  {
    target: ".mobile-nav-toggle",
    placement: "bottom",
    title: "Menu",
    content: "Tap to open the course list.",
    hideOverlay: true,
  },
  {
    target: "[data-tour='course-menu']",
    placement: "right",
    title: "Manage course",
    content: (
      <span>
        Tap the <span className="tour-kbd">⋮</span> next to a course to edit (rename, color) or delete it.
      </span>
    ),
    hideOverlay: true,
  },
  {
    target: "[data-tour='finals']",
    placement: "top",
    title: "Set finals",
    content: "Tap a course to set its final exam date — countdown starts.",
    hideOverlay: true,
  },
];

interface Props {
  run: boolean;
  onFinish: () => void;
  onSetMobileNav?: (open: boolean) => void;
}

const Tour: React.FC<Props> = ({ run, onFinish, onSetMobileNav }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  const handleEvent = (data: EventData) => {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status)) {
      if (isMobile) onSetMobileNav?.(false);
      onFinish();
      return;
    }
    if (!isMobile || !onSetMobileNav) return;
    const steps = mobileSteps;
    const targetIdx = steps.findIndex((s) => s.target === "[data-tour='course-menu']");
    if (targetIdx < 0) return;
    if (data.index === targetIdx - 1 && data.action === "next") {
      onSetMobileNav(true);
    } else if (data.index === targetIdx && data.action === "prev") {
      onSetMobileNav(false);
    } else if (data.index === targetIdx + 1) {
      onSetMobileNav(false);
    }
  };

  return (
    <Joyride
      steps={isMobile ? mobileSteps : desktopSteps}
      run={run}
      continuous
      onEvent={handleEvent}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip",
      }}
      options={{
        primaryColor: "#1db954",
        textColor: "#1a1a1a",
        backgroundColor: "#ffffff",
        arrowColor: "#ffffff",
        overlayColor: "rgba(0, 0, 0, 0.55)",
        zIndex: 10000,
        showProgress: true,
        skipBeacon: true,
        skipScroll: false,
        targetWaitTimeout: 0,
        overlayClickAction: false,
        blockTargetInteraction: false,
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          padding: "0.9rem 1rem",
          maxWidth: 280,
        },
        tooltipTitle: {
          fontSize: "0.95rem",
          fontWeight: 700,
          margin: 0,
        },
        tooltipContent: {
          fontSize: "0.85rem",
          lineHeight: 1.45,
          color: "#444",
          padding: "0.4rem 0",
        },
        buttonPrimary: {
          backgroundColor: "#1db954",
          borderRadius: 6,
          fontSize: "0.8rem",
          padding: "0.4rem 0.8rem",
          fontWeight: 600,
        },
        buttonBack: {
          color: "#555",
          fontSize: "0.8rem",
          marginRight: 4,
        },
        buttonSkip: {
          color: "#888",
          fontSize: "0.8rem",
        },
      }}
    />
  );
};

export default Tour;
