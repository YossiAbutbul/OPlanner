import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { useAuth } from "../context/AuthContext";
import { Settings, Plus, LogOut, HelpCircle } from "lucide-react";
import { deleteCourse, renameCourse } from "../utility/initializeDatabase";
import { CourseInfo } from "../App";
import { courseColor } from "../utility/courseColor";
import DeleteModal from "./DeleteModal";
import Modal from "./Modal";
import CourseEditModal from "./CourseEditModal";

interface SidebarProps {
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
  courses: CourseInfo[];
  onSelectCourse: (c: string | null) => void;
  onReorderCourses: (year: number, semester: string, names: string[]) => void;
  onYearsChanged: () => void;
  onAddYear: () => void;
  addingYear: boolean;
  onReplayTour: () => void;
  onUpdateCourseColor: (
    year: number,
    semesterKey: string,
    course: string,
    color: string | null
  ) => Promise<void>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const capitalizeWords = (str: string) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const Sidebar: React.FC<SidebarProps> = ({
  selectedYear,
  selectedSemester,
  selectedCourse,
  courses,
  onSelectCourse,
  onReorderCourses,
  onYearsChanged,
  onAddYear,
  addingYear,
  onReplayTour,
  onUpdateCourseColor,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ name: string; pos: "before" | "after" } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canManage = selectedYear !== null && !!selectedSemester;

  const handleDelete = async () => {
    if (!canManage || !confirmDelete) return;
    setBusy(true);
    try {
      await deleteCourse(selectedYear!, selectedSemester!, confirmDelete);
      if (selectedCourse === confirmDelete) onSelectCourse(null);
      setConfirmDelete(null);
      onYearsChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (target: string, pos: "before" | "after") => {
    if (!canManage || !draggingName || draggingName === target) {
      setDraggingName(null);
      setDragOver(null);
      return;
    }
    const courseNames = courses.map((c) => c.name);
    const from = courseNames.indexOf(draggingName);
    const targetIdx = courseNames.indexOf(target);
    if (from < 0 || targetIdx < 0) {
      setDraggingName(null);
      setDragOver(null);
      return;
    }
    const without = courseNames.filter((_, i) => i !== from);
    let insertAt = without.indexOf(target) + (pos === "after" ? 1 : 0);
    if (insertAt < 0) insertAt = 0;
    const next = [...without];
    next.splice(insertAt, 0, draggingName);
    setDraggingName(null);
    setDragOver(null);
    onReorderCourses(selectedYear!, selectedSemester!, next);
  };

  const handleEditSave = async (newName: string, color: string | null) => {
    if (!canManage || !editing) return;
    const original = editing;
    let nameForColor = original;
    if (newName && newName !== original) {
      const ok = await renameCourse(
        selectedYear!,
        selectedSemester!,
        original,
        newName
      );
      if (ok) {
        if (selectedCourse === original) onSelectCourse(newName);
        nameForColor = newName;
      }
    }
    const currentExplicit = courses.find((c) => c.name === original)?.color;
    if ((color ?? null) !== (currentExplicit ?? null)) {
      await onUpdateCourseColor(
        selectedYear!,
        selectedSemester!,
        nameForColor,
        color
      );
    }
    onYearsChanged();
  };

  return (
    <aside className={`sidebar ${!isMobile && collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand">
        <button
          className="brand-logo-btn"
          onClick={() => {
            if (isMobile) onCloseMobile();
            else setCollapsed((c) => !c);
          }}
          title={isMobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isMobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <img src="./Logo.svg" alt="" className="brand-logo" />
        </button>
        <span className="brand-name">OPlanner</span>
      </div>

      <div className="open-list-section">
        <div className="open-list-header">
          <span>Courses</span>
        </div>

        <ul className="open-list">
          {canManage && (
            <li
              className={`open-item overview-item ${selectedCourse === null ? "selected" : ""}`}
              onClick={() => { onSelectCourse(null); onCloseMobile(); }}
            >
              <span className="open-item-label">Overview</span>
            </li>
          )}
          {!canManage && (
            <li className="open-empty">Select a year and semester</li>
          )}
          {canManage && courses.length === 0 && (
            <li className="open-empty">No courses yet</li>
          )}
          {courses.map((c, idx) => {
            const name = c.name;
            const isActive = name === selectedCourse;
            const isDragging = draggingName === name;
            const showBefore =
              dragOver?.name === name && dragOver.pos === "before" && draggingName && draggingName !== name;
            const showAfter =
              dragOver?.name === name && dragOver.pos === "after" && draggingName && draggingName !== name;
            return (
              <li
                key={name}
                className={`open-item ${isActive ? "selected" : ""} ${isDragging ? "dragging" : ""} ${showBefore ? "drop-before" : ""} ${showAfter ? "drop-after" : ""}`}
                onClick={() => { onSelectCourse(name); onCloseMobile(); }}
                draggable
                onDragStart={(e) => {
                  setDraggingName(name);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", name);
                }}
                onDragOver={(e) => {
                  if (!draggingName) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const pos: "before" | "after" =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  if (dragOver?.name !== name || dragOver.pos !== pos) {
                    setDragOver({ name, pos });
                  }
                }}
                onDragLeave={() => {
                  if (dragOver?.name === name) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const pos: "before" | "after" =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  handleDrop(name, pos);
                }}
                onDragEnd={() => {
                  setDraggingName(null);
                  setDragOver(null);
                }}
              >
                <span className="open-item-label">{capitalizeWords(name)}</span>
                <button
                  className="open-item-menu-btn"
                  data-tour={idx === 0 ? "course-menu" : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menuOpen === name) {
                      setMenuOpen(null);
                      setMenuPos(null);
                    } else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenuPos({ top: rect.top, left: rect.right + 6 });
                      setMenuOpen(name);
                    }
                  }}
                  title="More"
                  aria-label="More"
                >
                  ⋮
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
          data-tour="settings"
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
            <button
              onClick={() => {
                setSettingsOpen(false);
                onReplayTour();
              }}
            >
              <HelpCircle size={16} />
              <span>Replay tour</span>
            </button>
            <div className="settings-menu-divider"></div>
            <button
              onClick={() => {
                setSettingsOpen(false);
                setConfirmSignOut(true);
              }}
              className="danger"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>

      {menuOpen && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="open-item-menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                const target = menuOpen;
                setMenuOpen(null);
                setMenuPos(null);
                setEditing(target);
                onCloseMobile();
              }}
            >
              Edit
            </button>
            <button
              className="danger"
              onClick={() => {
                const target = menuOpen;
                setMenuOpen(null);
                setMenuPos(null);
                setConfirmDelete(target);
                onCloseMobile();
              }}
            >
              Delete
            </button>
          </div>,
          document.body
        )}

      {editing && canManage && (() => {
        const c = courses.find((co) => co.name === editing);
        const explicit = c?.color;
        return (
          <CourseEditModal
            isOpen={!!editing}
            currentName={editing}
            currentColor={courseColor(editing, explicit)}
            hasExplicitColor={!!explicit}
            onClose={() => setEditing(null)}
            onSave={handleEditSave}
          />
        );
      })()}

      {confirmDelete && (
        <DeleteModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title="Delete course"
          message={`Delete "${confirmDelete}" and all its tasks? This cannot be undone.`}
        />
      )}

      <Modal
        isOpen={confirmSignOut}
        onClose={() => {
          if (!signingOut) setConfirmSignOut(false);
        }}
        title="Sign out"
        footer={
          <>
            <button
              type="button"
              className="app-modal-btn-cancel"
              onClick={() => setConfirmSignOut(false)}
              disabled={signingOut}
            >
              Cancel
            </button>
            <button
              type="button"
              className="app-modal-btn-primary"
              onClick={async () => {
                setSigningOut(true);
                try {
                  await logout();
                } finally {
                  setSigningOut(false);
                  setConfirmSignOut(false);
                }
              }}
              disabled={signingOut}
            >
              {signingOut ? (
                <span className="delete-modal-loading">
                  <span className="delete-modal-spinner" />
                  Signing out…
                </span>
              ) : (
                "Sign out"
              )}
            </button>
          </>
        }
      >
        <p>Are you sure you want to sign out? Your data will be saved before signing out.</p>
      </Modal>
    </aside>
  );
};

export default Sidebar;
