import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import DeleteModal from "./DeleteModal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { CourseTab, YearTreeData } from "../App";
import { Plus, X, Check } from "lucide-react";
import { addCourse, deleteCourse } from "../utility/initializeDatabase";

interface MainContentProps {
  years: YearTreeData[];
  yearsLoading: boolean;
  addingYear: boolean;
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
  onSelectYear: (y: number) => void;
  onSelectSemester: (s: string) => void;
  onSelectCourse: (c: string) => void;
  activeTab: CourseTab | null;
  onYearsChanged: () => void;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const MainContent: React.FC<MainContentProps> = ({
  years,
  yearsLoading,
  addingYear,
  selectedYear,
  selectedSemester,
  selectedCourse,
  onSelectYear,
  onSelectSemester,
  onSelectCourse,
  activeTab,
  onYearsChanged,
}) => {
  const { homework, fetchHomework, addHomework } = useHomework();
  const [filteredHomework, setFilteredHomework] = useState<HomeworkEntry[]>([]);
  const [isHomeworkModalOpen, setHomeworkModalOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab) {
      fetchHomework(activeTab.year, activeTab.semester, activeTab.course);
    }
  }, [activeTab, fetchHomework]);

  useEffect(() => {
    if (activeTab) {
      setFilteredHomework(homework.filter((hw) => hw.course === activeTab.course));
    } else {
      setFilteredHomework([]);
    }
  }, [activeTab, homework]);

  const sortedYears = [...years].sort((a, b) => a.year - b.year);
  const currentYear = years.find((y) => y.year === selectedYear) || null;
  const currentSemester =
    currentYear?.semesters.find((s) => s.name === selectedSemester) || null;

  const handleAddCourse = async () => {
    if (!selectedYear || !selectedSemester || !newCourseName.trim()) return;
    setIsLoadingAction(true);
    try {
      const name = capitalizeWords(newCourseName.trim());
      await addCourse(selectedYear, selectedSemester, name);
      onYearsChanged();
      setNewCourseName("");
      setAddCourseOpen(false);
      onSelectCourse(name);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirmDeleteCourse || !selectedYear || !selectedSemester) return;
    setIsLoadingAction(true);
    try {
      await deleteCourse(selectedYear, selectedSemester, confirmDeleteCourse);
      onYearsChanged();
      setConfirmDeleteCourse(null);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleSaveHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    if (!activeTab) return;
    const { year, semester, course } = activeTab;
    const capitalizedCourse = capitalizeWords(course);
    try {
      setIsLoadingAction(true);
      await addHomework(id, name, dueDate, status, year, semester, capitalizedCourse);
      await fetchHomework(year, semester, capitalizedCourse);
      setHomeworkModalOpen(false);
    } finally {
      setIsLoadingAction(false);
    }
  };

  return (
    <div className="main-layout">
      {/* Year tabs */}
      <div className="tab-bar tab-bar-year">
        {sortedYears.map((y) => (
          <button
            key={y.year}
            className={`tab year-tab ${selectedYear === y.year ? "active" : ""}`}
            onClick={() => onSelectYear(y.year)}
          >
            {y.year}
          </button>
        ))}
        {addingYear && <div className="tab skeleton skeleton-year"></div>}
      </div>

      {/* Semester tabs */}
      <div className="tab-bar tab-bar-semester">
        {currentYear &&
          currentYear.semesters.map((s) => (
            <button
              key={s.key}
              className={`tab semester-tab ${selectedSemester === s.name ? "active" : ""}`}
              onClick={() => onSelectSemester(s.name)}
            >
              {s.name}
            </button>
          ))}
      </div>

      {/* Course tabs */}
      <div className="tab-bar tab-bar-course">
        {currentSemester && (
          <>
          {currentSemester.courses.map((c) => (
            <div
              key={c.name}
              className={`tab course-tab ${selectedCourse === c.name ? "active" : ""}`}
              onClick={() => onSelectCourse(c.name)}
            >
              <span className="tab-label">{capitalizeWords(c.name)}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteCourse(c.name);
                }}
                title="Delete course"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {addCourseOpen ? (
            <div className="add-course-inline">
              <input
                autoFocus
                type="text"
                value={newCourseName}
                placeholder="Course name"
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCourse();
                  if (e.key === "Escape") {
                    setAddCourseOpen(false);
                    setNewCourseName("");
                  }
                }}
                disabled={isLoadingAction}
              />
              <button
                onClick={handleAddCourse}
                disabled={isLoadingAction}
                className="confirm"
                title="Add"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setAddCourseOpen(false);
                  setNewCourseName("");
                }}
                className="cancel"
                disabled={isLoadingAction}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              className="tab tab-add"
              onClick={() => setAddCourseOpen(true)}
              title="Add course"
            >
              <Plus size={14} />
              <span>Add course</span>
            </button>
          )}
          </>
        )}
      </div>


      {/* Content */}
      <div className="main-content">
        {activeTab ? (
          <>
            <h1>{capitalizeWords(activeTab.course)}</h1>
            <h2>
              {activeTab.semester}, {activeTab.year}
            </h2>
            <div className="progress-chart-container">
              <ProgressChart
                completed={
                  filteredHomework.filter((hw) => hw.status === "COMPLETED").length
                }
                pending={
                  filteredHomework.filter((hw) => hw.status === "PENDING").length
                }
              />
            </div>
            <div className="homework-table-container">
              <HomeworkTable
                tasks={filteredHomework}
                onAddTask={() => setHomeworkModalOpen(true)}
              />
            </div>
          </>
        ) : (
          <div className="empty-state" />
        )}
      </div>

      <HomeworkModal
        isOpen={isHomeworkModalOpen}
        onClose={() => setHomeworkModalOpen(false)}
        onSave={handleSaveHomework}
        selectedCourseData={activeTab}
        isLoading={isLoadingAction}
      />

      {confirmDeleteCourse && (
        <DeleteModal
          isOpen={!!confirmDeleteCourse}
          onClose={() => setConfirmDeleteCourse(null)}
          onConfirm={handleDeleteCourse}
          title="Delete course"
          message={`Delete "${confirmDeleteCourse}" and all its tasks? This cannot be undone.`}
        />
      )}
    </div>
  );
};

export default MainContent;
