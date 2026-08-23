import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../context/ToastContext";
import type { PlanCourse, PlanPayment } from "../types/models";
import { defaultPlanConfig } from "../services/plan";

// Firestore never runs in tests — the page reads everything through the
// context, which is mocked per case below.
vi.mock("../firebase", () => ({
  db: {},
  auth: { authStateReady: async () => {}, currentUser: { uid: "u1" } },
  googleProvider: {},
  requireUid: () => "u1",
}));

const courses: PlanCourse[] = [
  {
    id: "1",
    code: "62350",
    name: "Operating Systems",
    credits: 4,
    status: "IN_PROGRESS",
    year: 2026,
    semester: "Semester B",
    groupId: "mandatory",
    components: [{ id: "a", label: "Exam", weight: 60, grade: 82 }],
    updatedAt: 0,
  },
  {
    id: "2",
    code: "61101",
    name: "Calculus 1",
    credits: 5,
    status: "COMPLETED",
    year: 2025,
    semester: "Semester A",
    groupId: "mandatory",
    grade: 91,
    updatedAt: 0,
  },
];

const payments: PlanPayment[] = [
  { id: "p1", date: "2025-11-02", amount: 5900, kind: "TUITION", paid: true },
];

const plan = {
  config: {
    ...defaultPlanConfig(),
    degreeName: "B.Sc. Software Engineering",
    institution: "Braude College",
    totalCreditsRequired: 100,
    groups: [{ id: "mandatory", label: "Mandatory", requiredCredits: 60 }],
  },
  courses,
  payments,
  lastImport: null,
  loaded: true,
  isEmpty: false,
  refresh: vi.fn(),
  saveConfig: vi.fn(),
  upsertCourse: vi.fn(),
  removeCourse: vi.fn(),
  upsertPayment: vi.fn(),
  removePayment: vi.fn(),
  applyImport: vi.fn(),
  undoLastImport: vi.fn(),
};

const mockPlan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../context/PlanContext", () => ({
  usePlan: () => mockPlan.value,
  PlanProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const StudyPlanPage = (await import("./StudyPlanPage")).default;

const renderPage = (value: unknown) => {
  mockPlan.value = value;
  return render(
    <ToastProvider>
      <StudyPlanPage />
    </ToastProvider>
  );
};

describe("StudyPlanPage", () => {
  it("shows the degree headline, credits and average", () => {
    renderPage(plan);

    expect(screen.getByRole("heading", { name: "Study Plan" })).toBeInTheDocument();
    expect(screen.getByText(/B\.Sc\. Software Engineering/)).toBeInTheDocument();

    // 5 of 100 credits earned; Calculus is the only completed course.
    expect(screen.getByText("/ 100")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "Degree progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "5");
    // Average is 91: the in-progress course is projected, not averaged in.
    expect(screen.getByText("Average").parentElement).toHaveTextContent("91");
  });

  it("lists every course with its status", () => {
    renderPage(plan);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Operating Systems")).toBeInTheDocument();
    expect(within(table).getByText("In progress")).toBeInTheDocument();
    expect(within(table).getByText("Completed")).toBeInTheDocument();
    // The in-progress course has no final grade, so its parts estimate shows.
    expect(within(table).getByText("82 est.")).toBeInTheDocument();
  });

  it("shows money paid and what is still projected", () => {
    renderPage(plan);
    expect(screen.getAllByText("₪5,900").length).toBeGreaterThan(0);
  });

  it("shows the empty state before anything is stored", () => {
    renderPage({ ...plan, isEmpty: true, courses: [], payments: [] });
    expect(screen.getByText("Let's map out your degree")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Import from your university/ })
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a skeleton until the plan loads", () => {
    const { container } = renderPage({ ...plan, loaded: false });
    expect(container.querySelector(".sp-skeleton")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Study Plan" })).toBeNull();
  });
});
