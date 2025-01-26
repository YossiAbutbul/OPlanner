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
  const [loading, setLoading] = useState(false); // For loading states
  const [error, setError] = useState<string | null>(null); // For error messages

  const fetchYearsAndSemesters = async () => {
    setLoading(true);
    setError(null);
    try {
      const existingYears = await getAllYearsAndSemesters();
      const formattedYears = existingYears.map((year) => ({
        ...year,
        expanded: false,
        semesters: year.semesters.map((semester) => ({
          ...semester,
          expanded: false,
          courses: semester.courses || [],
        })),
      }));
      setYears(formattedYears);
    } catch (err) {
      console.error("Error fetching years and semesters:", err);
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearsAndSemesters();
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

  const handleAddCourse = async () => {
    if (modalData && newCourseName.trim() !== "") {
      setLoading(true);
      try {
        await addCourse(modalData.year, modalData.semester, newCourseName.trim());
        await fetchYearsAndSemesters();
        setModalOpen(false);
        setNewCourseName("");
      } catch (err) {
        console.error("Error adding course:", err);
        setError("Failed to add course. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      alert("Please enter a valid course name.");
    }
  };

  const handleCourseSelect = (year: number, semester: string, course: string) => {
    console.log("Switching to course:", { year, semester, course });
    onCourseOrSemesterSelect(year, semester, course);
  };

  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img src="./user-svgrepo-com.svg" alt="Profile" className="profile-pic" />
        <div className="profile-header">
          <label className="profile-label">OPlanner</label>
          <button
            className="add-year-btn"
            onClick={() => initializeYear(new Date().getFullYear())}
            title="Add Year"
          >
            <i className="bx bx-plus"></i>
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <ul className="year-list">
          {years.map((year, yearIndex) => (
            <li key={year.year} className={`year-item ${year.expanded ? "expanded" : ""}`}>
              <div className="year-header" onClick={() => toggleExpand(yearIndex)}>
                {year.year}
                <i
                  className={`bx ${year.expanded ? "bx-chevron-up" : "bx-chevron-down"} toggle-icon`}
                ></i>
              </div>
              {year.expanded && (
                <ul className="semester-list">
                  {year.semesters.map((semester, semesterIndex) => (
                    <li
                      key={semester.key}
                      className={`semester-item ${semester.expanded ? "expanded" : ""}`}
                    >
                      <div
                        className="semester-header"
                        onClick={() => toggleExpand(yearIndex, semesterIndex)}
                      >
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
                              onClick={() => handleCourseSelect(year.year, semester.name, course.name)}
                            >
                              {course.name}
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
      )}

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
    </aside>
  );
};

export default Sidebar;
