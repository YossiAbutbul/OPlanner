import React, { useState } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
import Login from "./components/Login";
import { useAuth } from "./context/AuthContext";

export interface CourseTab {
  year: number;
  semester: string;
  course: string;
}

export const tabKey = (t: CourseTab): string =>
  `${t.year}|${t.semester}|${t.course}`;

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [tabs, setTabs] = useState<CourseTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const openCourse = (year: number, semester: string, course?: string) => {
    if (!course) return;
    const newTab: CourseTab = { year, semester, course };
    const key = tabKey(newTab);
    setTabs((prev) =>
      prev.some((t) => tabKey(t) === key) ? prev : [...prev, newTab]
    );
    setActiveKey(key);
  };

  const switchTab = (key: string) => setActiveKey(key);

  const closeTab = (key: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => tabKey(t) === key);
      if (idx === -1) return prev;
      const next = prev.filter((t) => tabKey(t) !== key);
      if (activeKey === key) {
        const fallback = next[idx] || next[idx - 1] || next[0] || null;
        setActiveKey(fallback ? tabKey(fallback) : null);
      }
      return next;
    });
  };

  const activeTab = tabs.find((t) => tabKey(t) === activeKey) || null;

  if (loading) {
    return (
      <div className="app-loading">
        <i className="bx bx-loader-alt bx-spin"></i>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app-container">
      <Sidebar onCourseOrSemesterSelect={openCourse} />
      <MainContent
        tabs={tabs}
        activeKey={activeKey}
        activeTab={activeTab}
        onSwitchTab={switchTab}
        onCloseTab={closeTab}
      />
      <RightSidebar />
    </div>
  );
};

export default App;
