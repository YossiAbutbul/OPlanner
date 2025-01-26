import React, { useState, useEffect, useRef } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import {
  getAllYearsAndSemesters,
  initializeYear,
  addCourse,
  renameCourse,
  deleteCourse,
} from "../utility/initializeDatabase";

interface YearData {
  year: number;
  semesters: {
    name: string;
    key: string;
    courses: { name: string }[];
    expanded: boolean;
  }[];
  expanded: boolean;
}

interface SidebarProps {
  onCourseOrSemesterSelect: (
    year: number,
    semester: string,
    course?: string
  ) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCourseOrSemesterSelect }) => {
  const [years, setYears] = useState<YearData[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ year: number; semester: string } | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    year: number;
    semester: string;
    course: string;
    x: number;
    y: number;
  } | null>(null);
  const [renameModal, setRenameModal] = useState<{
    year: number;
    semester: string;
    course: string;
  } | null>(null);
  const [renameCourseName, setRenameCourseName] = useState("");
  const [isAddingYear, setIsAddingYear] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  const fetchYearsAndSemesters = async (preserveState = false) => {
    try {
      const existingYears = await getAllYearsAndSemesters();
      const formattedYears = existingYears.map((year) => {
        const existingYear = years.find((y) => y.year === year.year);
        return {
          ...year,
          expanded: preserveState ? existingYear?.expanded || false : false,
          semesters: year.semesters.map((semester) => {
            const existingSemester = existingYear?.semesters.find(
              (s) => s.name === semester.name
            );
            return {
              ...semester,
              expanded: preserveState ? existingSemester?.expanded || false : false,
              courses: semester.courses || [],
            };
          }),
        };
      });
      setYears(formattedYears);
    } catch (error) {
      console.error("Error fetching years and semesters:", error);
    }
  };

  useEffect(() => {
    fetchYearsAndSemesters();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleExpand = (yearIndex: number, semesterIndex?: number) => {
    setYears((prevYears) =>
      prevYears.map((year, yIndex) => {
        if (yIndex === yearIndex) {
          return {
            ...year,
            expanded: semesterIndex === undefined ? !year.expanded : year.expanded,
            semesters: semesterIndex !== undefined
              ? year.semesters.map((semester, sIndex) => ({
                  ...semester,
                  expanded: sIndex === semesterIndex ? !semester.expanded : semester.expanded,
                }))
              : year.semesters,
          };
        }
        return year;
      })
    );
  };

  const handleAddYear = async () => {
  let yearToAdd = new Date().getFullYear();

  while (true) {
    setIsAddingYear(true);

    const yearAdded = await initializeYear(yearToAdd);

    if (yearAdded) {
      await fetchYearsAndSemesters(true); // Preserve expanded state
      setIsAddingYear(false);
      break; // Successfully added a year, exit the loop
    } else {
      console.warn(`Year ${yearToAdd} already exists. Trying the next year.`);
      yearToAdd += 1; // Increment to the next year
    }
  }
};


  const handleAddCourse = async () => {
    if (modalData && newCourseName.trim() !== "") {
      try {
        await addCourse(modalData.year, modalData.semester, newCourseName.trim());
        await fetchYearsAndSemesters(true); // Preserve expanded state
        setModalOpen(false);
        setNewCourseName("");
      } catch (error) {
        console.error("Error adding course:", error);
      }
    } else {
      alert("Please enter a valid course name.");
    }
  };

  const handleRenameCourse = async () => {
    if (renameModal && renameCourseName.trim() !== "") {
      try {
        await renameCourse(
          renameModal.year,
          renameModal.semester,
          renameModal.course,
          renameCourseName.trim()
        );
        await fetchYearsAndSemesters(true); // Preserve expanded state
        setRenameModal(null);
        setRenameCourseName("");
      } catch (error) {
        console.error("Error renaming course:", error);
      }
    } else {
      alert("Please enter a valid course name.");
    }
  };

  const handleDeleteCourse = async (year: number, semester: string, course: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${course}"?`);
    if (confirmDelete) {
      try {
        await deleteCourse(year, semester, course);
        await fetchYearsAndSemesters(true); // Preserve expanded state
      } catch (error) {
        console.error("Error deleting course:", error);
      }
    }
  };

  const openContextMenu = (e: React.MouseEvent, year: number, semester: string, course: string) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setContextMenu({
      year,
      semester,
      course,
      x: rect.right + 10,
      y: rect.top,
    });
  };

  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img src="./user-svgrepo-com.svg" alt="Profile" className="profile-pic" />
        <div className="profile-header">
          <label className="profile-label">OPlanner</label>
          <button
            className="add-year-btn"
            onClick={handleAddYear}
            title="Add Year"
            disabled={isAddingYear}
          >
            {isAddingYear ? <i className='bx bx-loader-alt bx-spin bx-flip-vertical' ></i> : <i className="bx bx-plus"></i>}
          </button>
        </div>
      </div>
      <ul className="year-list">
        {years.map((year, yearIndex) => (
          <li key={year.year} className={`year-item ${year.expanded ? "expanded" : ""}`}>
            <div className="year-header" onClick={() => toggleExpand(yearIndex)}>
              {year.year}
              <i className={`bx ${year.expanded ? "bx-chevron-up" : "bx-chevron-down"} toggle-icon`}></i>
            </div>
            {year.expanded && (
              <ul className="semester-list">
                {year.semesters.map((semester, semesterIndex) => (
                  <li
                    key={semester.key}
                    className={`semester-item ${semester.expanded ? "expanded" : ""}`}
                  >
                    <div className="semester-header" onClick={() => toggleExpand(yearIndex, semesterIndex)}>
                      {semester.name}
                      <i
                        className="bx bx-plus add-course-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalData({ year: year.year, semester: semester.name });
                          setModalOpen(true);
                        }}
                        title="Add New Course"
                      ></i>
                    </div>
                    {semester.expanded && (
                      <ul className="course-list">
                        {semester.courses.map((course) => (
                          <li
                            key={course.name}
                            className="course-item"
                            onClick={() => {
                              console.log("Switching to course:", {
                                year: year.year,
                                semester: semester.name,
                                course: course.name,
                              });
                              onCourseOrSemesterSelect(year.year, semester.name, course.name);
                            }}
                          >
                            {course.name}
                            <i
                              className="bx bx-dots-vertical-rounded context-menu-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openContextMenu(e, year.year, semester.name, course.name);
                              }}
                            ></i>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add New Course</h2>
            <input
              type="text"
              placeholder="Enter Course Name"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleAddCourse}>
                Add Course
              </button>
              <button className="modal-btn cancel-btn" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <button
            onClick={() => {
              setRenameModal({
                year: contextMenu.year,
                semester: contextMenu.semester,
                course: contextMenu.course,
              });
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              handleDeleteCourse(contextMenu.year, contextMenu.semester, contextMenu.course);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {renameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Rename Course</h2>
            <input
              type="text"
              placeholder="Enter New Course Name"
              value={renameCourseName}
              onChange={(e) => setRenameCourseName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleRenameCourse}>
                Rename
              </button>
              <button className="modal-btn cancel-btn" onClick={() => setRenameModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
