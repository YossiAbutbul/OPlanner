import React, { useState, useEffect, useRef } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { useAuth } from "../context/AuthContext";
import { Settings, Plus, LogOut, X } from "lucide-react";
import { CourseTab, tabKey } from "../App";

interface SidebarProps {
  openCourses: CourseTab[];
  activeKey: string | null;
  onSwitchTab: (key: string) => void;
  onCloseTab: (key: string) => void;
  onAddYear: () => void;
  addingYear: boolean;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const Sidebar: React.FC<SidebarProps> = ({
  openCourses,
  activeKey,
  onSwitchTab,
  onCloseTab,
  onAddYear,
  addingYear,
}) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <button
          className="brand-logo-btn"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <img src="./Logo.svg" alt="" className="brand-logo" />
        </button>
        <span className="brand-name">OPlanner</span>
      </div>

      <div className="open-list-section">
        <div className="open-list-header">Open</div>
        <ul className="open-list">
          {openCourses.length === 0 && (
            <li className="open-empty">No courses open</li>
          )}
          {openCourses.map((c) => {
            const key = tabKey(c);
            const isActive = key === activeKey;
            return (
              <li
                key={key}
                className={`open-item ${isActive ? "selected" : ""}`}
                onClick={() => onSwitchTab(key)}
                title={`${c.semester}, ${c.year}`}
              >
                <span className="open-item-label">{capitalizeWords(c.course)}</span>
                <span className="open-item-meta">
                  {c.semester.replace("Semester ", "")} · {c.year}
                </span>
                <button
                  className="open-item-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(key);
                  }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-footer" ref={settingsRef}>
        <button
          className="footer-avatar-btn"
          onClick={() => collapsed && setSettingsOpen((o) => !o)}
          title={collapsed ? "Settings" : ""}
          aria-label={collapsed ? "Open settings" : "Profile"}
        >
          <img
            src={user?.photoURL || "./user-svgrepo-com.svg"}
            alt=""
            className="footer-avatar"
            referrerPolicy="no-referrer"
          />
        </button>
        <div className="footer-info">
          <div className="footer-name">{user?.displayName || "User"}</div>
          {user?.email && <div className="footer-email">{user.email}</div>}
        </div>
        <button
          className="footer-settings"
          onClick={() => setSettingsOpen((o) => !o)}
          title="Settings"
        >
          <Settings size={18} />
        </button>
        {settingsOpen && (
          <div className="settings-menu">
            <button
              onClick={() => {
                setSettingsOpen(false);
                onAddYear();
              }}
              disabled={addingYear}
            >
              <Plus size={16} />
              <span>Add year</span>
            </button>
            <div className="settings-menu-divider"></div>
            <button
              onClick={() => {
                setSettingsOpen(false);
                logout();
              }}
              className="danger"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
