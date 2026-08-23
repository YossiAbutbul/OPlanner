import React, { useState } from "react";
import { BookPlus, Coins, Download, GraduationCap, ListChecks, Settings, Undo2 } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { useToast } from "../context/ToastContext";
import { usePlanStats } from "../hooks/usePlanStats";
import DegreeHero from "./StudyPlan/DegreeHero";
import NextUpPanel from "./StudyPlan/NextUpPanel";
import GradesPanel from "./StudyPlan/GradesPanel";
import MoneyPanel from "./StudyPlan/MoneyPanel";
import PlanCoursesTable from "./StudyPlan/PlanCoursesTable";
import PlanCourseModal from "./StudyPlan/PlanCourseModal";
import PlanSettingsModal from "./StudyPlan/PlanSettingsModal";
import PaymentModal from "./StudyPlan/PaymentModal";
import ImportPlanModal from "./StudyPlan/ImportPlanModal";
import DeleteModal from "./DeleteModal";
import type { PlanCourse, PlanPayment } from "../types/models";
import "../css/StudyPlan.css";

// Degree-wide view: credits, grades and money for the whole degree. Left to
// right like the rest of OPlanner; Hebrew course names are bidi-isolated so
// they still read correctly inside the rows.
const StudyPlanPage: React.FC = () => {
  const {
    config,
    courses,
    payments,
    loaded,
    isEmpty,
    lastImport,
    saveConfig,
    upsertCourse,
    removeCourse,
    upsertPayment,
    removePayment,
    applyImport,
    undoLastImport,
  } = usePlan();
  const toast = useToast();
  const stats = usePlanStats(config, courses, payments);

  const [courseModal, setCourseModal] = useState<{ open: boolean; course: PlanCourse | null }>({
    open: false,
    course: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; payment: PlanPayment | null }>({
    open: false,
    payment: null,
  });
  const [confirmCourse, setConfirmCourse] = useState<PlanCourse | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<PlanPayment | null>(null);

  const handleSaveCourse = async (course: PlanCourse) => {
    const isNew = !courses.some((c) => c.id === course.id);
    await upsertCourse(course);
    toast.success(isNew ? `Course “${course.name}” added` : `Course “${course.name}” updated`);
  };

  // Inline grade edit. A grade on a planned or running course settles it.
  const handleSetGrade = async (course: PlanCourse, grade: number | undefined) => {
    const next: PlanCourse = { ...course, grade };
    if (grade === undefined) delete next.grade;
    if (grade !== undefined && (course.status === "PLANNED" || course.status === "IN_PROGRESS")) {
      next.status = grade >= config.passMark ? "COMPLETED" : "FAILED";
    }
    await upsertCourse(next);
  };

  const handleSchedule = async (course: PlanCourse, year: number, semester: string) => {
    await upsertCourse({ ...course, year, semester });
    toast.success(`“${course.name}” moved to ${semester.replace("Semester ", "Sem ")} ${year}`);
  };

  const handleImport = async (
    created: PlanCourse[],
    updated: PlanCourse[],
    before: PlanCourse[],
    meta: { fileName?: string; adapter: string }
  ) => {
    await applyImport(created, updated, before, meta);
    toast.success(
      `Imported ${created.length} new and ${updated.length} updated course${
        created.length + updated.length === 1 ? "" : "s"
      }`,
      {
        action: {
          label: "Undo",
          onClick: () => {
            void undoLastImport()
              .then(() => toast.info("Import undone"))
              .catch(() => toast.error("Could not undo the import"));
          },
        },
      }
    );
  };

  if (!loaded) {
    return (
      <div className="sp-page sp-page-loading">
        <div className="sp-skeleton sp-skeleton-head" />
        <div className="sp-skeleton sp-skeleton-hero" />
        <div className="sp-skeleton sp-skeleton-grid" />
      </div>
    );
  }

  return (
    <div className="sp-page">
      <header className="sp-header">
        <div className="sp-header-title">
          <h1>Study Plan</h1>
          <p className="sp-header-sub">
            {config.degreeName}
            {config.institution ? ` · ${config.institution}` : ""}
            {config.totalCreditsRequired > 0 ? ` · ${config.totalCreditsRequired} credits` : ""}
          </p>
        </div>
        {!isEmpty && (
          <div className="sp-header-actions">
            <button type="button" className="sp-btn" onClick={() => setImportOpen(true)}>
              <Download size={16} />
              <span>Import</span>
            </button>
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              onClick={() => setCourseModal({ open: true, course: null })}
            >
              <BookPlus size={16} />
              <span>Add course</span>
            </button>
            <button
              type="button"
              className="sp-btn sp-btn-icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Study plan settings"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        )}
      </header>

      {isEmpty ? (
        <section className="sp-empty">
          <div className="sp-empty-art" aria-hidden="true">
            <GraduationCap size={34} strokeWidth={1.7} />
          </div>
          <h2 className="sp-empty-title">Let's map out your degree</h2>
          <p className="sp-empty-text">
            Every course of the degree in one place: credits earned against credits required,
            grades, and what the whole thing costs.
          </p>
          <div className="sp-empty-actions">
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              onClick={() => setImportOpen(true)}
            >
              <Download size={16} />
              <span>Import from your university</span>
            </button>
            <button
              type="button"
              className="sp-btn"
              onClick={() => setCourseModal({ open: true, course: null })}
            >
              <BookPlus size={16} />
              <span>Add a course</span>
            </button>
          </div>
          <ul className="sp-empty-hints">
            <li>
              <ListChecks size={16} strokeWidth={2} />
              Credits tracked to the last point
            </li>
            <li>
              <GraduationCap size={16} strokeWidth={2} />
              Average and graduation term
            </li>
            <li>
              <Coins size={16} strokeWidth={2} />
              Paid so far and still ahead
            </li>
          </ul>
          <button type="button" className="sp-link-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            Set up the degree first
          </button>
        </section>
      ) : (
        <>
          <DegreeHero stats={stats} config={config} onOpenSettings={() => setSettingsOpen(true)} />

          <NextUpPanel
            courses={courses}
            stats={stats}
            onSchedule={handleSchedule}
            onAddCourse={() => setCourseModal({ open: true, course: null })}
          />

          <div className="sp-two">
            <GradesPanel
              stats={stats}
              config={config}
              courses={courses}
              onSetGrade={handleSetGrade}
            />
            <MoneyPanel
              stats={stats}
              config={config}
              payments={payments}
              onAdd={() => setPaymentModal({ open: true, payment: null })}
              onEdit={(p) => setPaymentModal({ open: true, payment: p })}
              onDelete={(p) => setConfirmPayment(p)}
              onConfigure={() => setSettingsOpen(true)}
            />
          </div>

          <PlanCoursesTable
            courses={courses}
            config={config}
            onEdit={(c) => setCourseModal({ open: true, course: c })}
            onDelete={(c) => setConfirmCourse(c)}
            onSetGrade={handleSetGrade}
          />

          {lastImport && (
            <div className="sp-footnote">
              <span>
                Last import {lastImport.fileName ? `“${lastImport.fileName}”` : ""} added{" "}
                {lastImport.createdIds.length} and updated {lastImport.updatedBefore.length}{" "}
                courses.
              </span>
              <button
                type="button"
                className="sp-link-btn"
                onClick={() => {
                  void undoLastImport()
                    .then(() => toast.info("Import undone"))
                    .catch(() => toast.error("Could not undo the import"));
                }}
              >
                <Undo2 size={14} />
                Undo import
              </button>
            </div>
          )}
        </>
      )}

      <PlanCourseModal
        isOpen={courseModal.open}
        course={courseModal.course}
        config={config}
        onClose={() => setCourseModal({ open: false, course: null })}
        onSave={handleSaveCourse}
      />

      <PlanSettingsModal
        isOpen={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={async (next) => {
          await saveConfig(next);
          toast.success("Study plan settings saved");
        }}
      />

      <PaymentModal
        isOpen={paymentModal.open}
        payment={paymentModal.payment}
        config={config}
        onClose={() => setPaymentModal({ open: false, payment: null })}
        onSave={async (p) => {
          await upsertPayment(p);
          toast.success(paymentModal.payment ? "Payment updated" : "Payment added");
        }}
      />

      <ImportPlanModal
        isOpen={importOpen}
        config={config}
        courses={courses}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        onSaveConfig={saveConfig}
      />

      {confirmCourse && (
        <DeleteModal
          isOpen={!!confirmCourse}
          onClose={() => setConfirmCourse(null)}
          onConfirm={async () => {
            const target = confirmCourse;
            await removeCourse(target.id);
            setConfirmCourse(null);
            toast.success(`Deleted “${target.name}”`);
          }}
          title="Delete course"
          message={`Delete "${confirmCourse.name}" from your study plan? This cannot be undone.`}
        />
      )}

      {confirmPayment && (
        <DeleteModal
          isOpen={!!confirmPayment}
          onClose={() => setConfirmPayment(null)}
          onConfirm={async () => {
            const target = confirmPayment;
            await removePayment(target.id);
            setConfirmPayment(null);
            toast.success("Payment deleted");
          }}
          title="Delete payment"
          message="Delete this payment? This cannot be undone."
        />
      )}
    </div>
  );
};

export default StudyPlanPage;
