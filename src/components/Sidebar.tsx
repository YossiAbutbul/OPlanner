import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { useAuth } from "../context/AuthContext";
import { Settings, Plus, LogOut, RefreshCw } from "lucide-react";
import { addCourse, deleteCourse, renameCourse } from "../utility/initializeDatabase";
import DeleteModal from "./DeleteModal";
import Modal from "./Modal";

interface SidebarProps {
  selectedYear: number | null;
  selectedSemester: string | null;
  selectedCourse: string | null;
  courses: string[];
  onSelectCourse: (c: string | null) => void;
  onReorderCourses: (year: number, semester: string, names: string[]) => void;
  onYearsChanged: () => void;
  onAddYear: () => void;
  addingYear: boolean;
  onSync: () => void;
  syncing: boolean;
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
  onSync,
  syncing,
}) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ name: string; pos: "before" | "after" } | null>(null);

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

  const handleAdd = async () => {
    if (!canManage || !newCourseName.trim()) return;
    setBusy(true);
    try {
      const name = capitalizeWords(newCourseName.trim());
      await addCourse(selectedYear!, selectedSemester!, name);
      setNewCourseName("");
      setAddOpen(false);
      onYearsChanged();
      onSelectCourse(name);
    } finally {
      setBusy(false);
    }
  };

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
    const from = courses.indexOf(draggingName);
    const targetIdx = courses.indexOf(target);
    if (from < 0 || targetIdx < 0) {
      setDraggingName(null);
      setDragOver(null);
      return;
    }
    const without = courses.filter((_, i) => i !== from);
    let insertAt = without.indexOf(target) + (pos === "after" ? 1 : 0);
    if (insertAt < 0) insertAt = 0;
    const next = [...without];
    next.splice(insertAt, 0, draggingName);
    setDraggingName(null);
    setDragOver(null);
    onReorderCourses(selectedYear!, selectedSemester!, next);
  };

  const startRename = (name: string) => {
    setRenaming(name);
    setRenameValue(capitalizeWords(name));
    setMenuOpen(null);
    setMenuPos(null);
  };

  const commitRename = async () => {
    if (!canManage || !renaming) return;
    const next = capitalizeWords(renameValue.trim());
    if (!next || next === renaming) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    try {
      const ok = await renameCourse(selectedYear!, selectedSemester!, renaming, next);
      if (ok) {
        if (selectedCourse === renaming) onSelectCourse(next);
        onYearsChanged();
      }
    } finally {
      setBusy(false);
      setRenaming(null);
    }
  };

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
        <div className="open-list-header">
          <span>Courses</span>
          {canManage && (
            <button
              className="open-list-add"
              onClick={() => setAddOpen(true)}
              title="Add course"
              aria-label="Add course"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <ul className="open-list">
          {canManage && (
            <li
              className={`open-item overview-item ${selectedCourse === null ? "selected" : ""}`}
              onClick={() => onSelectCourse(null)}
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
          {courses.map((name) => {
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
                onClick={() => onSelectCourse(name)}
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
                onSync();
              }}
              disabled={syncing}
            >
              <RefreshCw size={16} />
              <span>{syncing ? "Syncing…" : "Sync now"}</span>
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

      {menuOpen && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="open-item-menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => startRename(menuOpen)}>Rename</button>
            <button
              className="danger"
              onClick={() => {
                const target = menuOpen;
                setMenuOpen(null);
                setMenuPos(null);
                setConfirmDelete(target);
              }}
            >
              Delete
            </button>
          </div>,
          document.body
        )}

      <Modal
        isOpen={addOpen}
        onClose={() => {
          if (busy) return;
          setAddOpen(false);
          setNewCourseName("");
        }}
        title="Add course"
        footer={
          <>
            <button
              className="app-modal-btn-cancel"
              onClick={() => {
                setAddOpen(false);
                setNewCourseName("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn-primary"
              onClick={handleAdd}
              disabled={busy || !newCourseName.trim()}
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </>
        }
      >
        <input
          autoFocus
          type="text"
          value={newCourseName}
          placeholder="Course name"
          onChange={(e) => setNewCourseName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          disabled={busy}
        />
      </Modal>

      <Modal
        isOpen={!!renaming}
        onClose={() => !busy && setRenaming(null)}
        title="Rename course"
        footer={
          <>
            <button
              className="app-modal-btn-cancel"
              onClick={() => setRenaming(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn-primary"
              onClick={commitRename}
              disabled={busy || !renameValue.trim()}
            >
              {busy ? "Renaming…" : "Rename"}
            </button>
          </>
        }
      >
        <input
          autoFocus
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
          }}
          disabled={busy}
        />
      </Modal>

      {confirmDelete && (
        <DeleteModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title="Delete course"
          message={`Delete "${confirmDelete}" and all its tasks? This cannot be undone.`}
        />
      )}
    </aside>
  );
};

export default Sidebar;
