import React, { useState, useEffect } from "react";
import ProgressChart from "./ProgressChart";
import HomeworkTable from "./HomeworkTable";
import HomeworkModal from "./HomeworkModal";
import "../css/MainContent.css";
import { useHomework, HomeworkEntry } from "../context/HomeworkContext";
import { CourseTab, tabKey } from "../App";
import { X } from "lucide-react";

interface MainContentProps {
  tabs: CourseTab[];
  activeKey: string | null;
  activeTab: CourseTab | null;
  onSwitchTab: (key: string) => void;
  onCloseTab: (key: string) => void;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const MainContent: React.FC<MainContentProps> = ({
  tabs,
  activeKey,
  activeTab,
  onSwitchTab,
  onCloseTab,
}) => {
  const { homework, fetchHomework, addHomework } = useHomework();
  const [filteredHomework, setFilteredHomework] = useState<HomeworkEntry[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  useEffect(() => {
    if (activeTab) {
      fetchHomework(activeTab.year, activeTab.semester, activeTab.course);
    }
  }, [activeTab, fetchHomework]);

  useEffect(() => {
    if (activeTab) {
      setFilteredHomework(
        homework.filter((hw) => hw.course === activeTab.course)
      );
    } else {
      setFilteredHomework([]);
    }
  }, [activeTab, homework]);

  const handleSaveHomework = async (
    id: string | null,
    name: string,
    dueDate: string,
    status: string
  ) => {
    if (!activeTab) {
      alert("Please select a valid course.");
      return;
    }
    const { year, semester, course } = activeTab;
    const capitalizedCourse = capitalizeWords(course);
    try {
      setIsLoadingAction(true);
      await addHomework(id, name, dueDate, status, year, semester, capitalizedCourse);
      await fetchHomework(year, semester, capitalizedCourse);
      setModalOpen(false);
    } catch (error) {
      console.error("Error saving homework:", error);
    } finally {
      setIsLoadingAction(false);
    }
  };

  return (
    <div className="main-layout">
      {tabs.length > 0 && (
        <div className="tab-bar">
          {tabs.map((tab) => {
            const key = tabKey(tab);
            const isActive = key === activeKey;
            return (
              <div
                key={key}
                className={`tab ${isActive ? "active" : ""}`}
                onClick={() => onSwitchTab(key)}
                title={`${tab.semester}, ${tab.year}`}
              >
                <span className="tab-label">{capitalizeWords(tab.course)}</span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(key);
                  }}
                  title="Close tab"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
                onAddTask={() => setModalOpen(true)}
              />
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h1>No course open</h1>
            <p>Pick a course from the sidebar to open it as a tab.</p>
          </div>
        )}
      </div>

      <HomeworkModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveHomework}
        selectedCourseData={activeTab}
        isLoading={isLoadingAction}
      />
    </div>
  );
};

export default MainContent;
